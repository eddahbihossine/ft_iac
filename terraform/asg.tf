locals {
  ha_enabled = var.enable_alb
}

resource "aws_iam_role_policy" "app_instance_access" {
  count = local.ha_enabled ? 1 : 0
  name  = "${var.environment}-app-instance-access"
  role  = aws_iam_role.ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "ReadAppArtifact"
          Effect = "Allow"
          Action = ["s3:GetObject"]
          Resource = [
            "${aws_s3_bucket.artifacts[0].arn}/${aws_s3_object.app_zip[0].key}"
          ]
        }
      ],
      var.enable_database ? [
        {
          Sid    = "ReadDbSecret"
          Effect = "Allow"
          Action = ["secretsmanager:GetSecretValue"]
          Resource = [
            aws_db_instance.mysql[0].master_user_secret[0].secret_arn
          ]
        }
      ] : []
    )
  })
}

resource "aws_launch_template" "app" {
  count = local.ha_enabled ? 1 : 0

  name_prefix   = "${var.environment}-app-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = local.selected_server_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ssm_profile.name
  }

  key_name = aws_key_pair.deployer.key_name

  vpc_security_group_ids = [aws_security_group.ec2_sg.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

    dnf update -y
    dnf install -y amazon-ssm-agent
    systemctl enable --now amazon-ssm-agent

    dnf install -y docker git unzip nginx awscli jq

    systemctl enable --now docker
    systemctl enable --now nginx

    # Install Docker Compose v2
    DOCKER_COMPOSE_VERSION="${var.docker_compose_version}"
    curl -fsSL "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    # Add swap so Docker builds are less likely to stall/OOM on small instances.
    fallocate -l ${var.swap_size_gb}G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$(( ${var.swap_size_gb} * 1024 ))
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

    mkdir -p /opt/app
    cd /opt/app

    aws s3 cp "s3://${aws_s3_bucket.artifacts[0].bucket}/${aws_s3_object.app_zip[0].key}" /opt/app/app.zip --region "${local.selected_region}"
    unzip -o /opt/app/app.zip -d /opt/app

    # Runtime env
    MYSQL_HOST=""
    MYSQL_USER=""
    MYSQL_PASSWORD=""
    MYSQL_DATABASE="${var.db_name}"
    MYSQL_PORT="${var.db_port}"

    if ${var.enable_database}; then
      SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "${aws_db_instance.mysql[0].master_user_secret[0].secret_arn}" --query SecretString --output text --region "${local.selected_region}")
      MYSQL_USER=$(echo "$SECRET_JSON" | jq -r '.username')
      MYSQL_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.password')
      MYSQL_HOST="${aws_db_instance.mysql[0].address}"
    else
      echo "ERROR: enable_database must be true in HA mode" >&2
      exit 1
    fi

    cat > /opt/app/.env.runtime <<ENV
    MYSQL_HOST=$MYSQL_HOST
    MYSQL_PORT=$MYSQL_PORT
    MYSQL_USER=$MYSQL_USER
    MYSQL_PASSWORD=$MYSQL_PASSWORD
    MYSQL_DATABASE=$MYSQL_DATABASE
    DB_INIT_SYNC=true
    ENV

    APP_PUBLIC_PORT="${var.app_public_port}"
    APP_UPSTREAM_PORT="${var.app_upstream_port}"
    APP_HEALTH_PATH="${var.app_health_path}"
    BANNER_PREFIX="${var.server_identity_banner_prefix}"

    # Compose file for HA: API only, on host 3001
    cat > /opt/app/docker-compose.ha.yml <<'YML'
    services:
      api:
        build:
          context: .
          dockerfile: dockerfile
          target: production
        container_name: nest_api
        env_file: .env.runtime
        ports:
          - "__UPSTREAM_PORT__:3000"
        restart: unless-stopped
        healthcheck:
          test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000__HEALTH_PATH__', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
          interval: 30s
          timeout: 3s
          start_period: 40s
          retries: 3
    YML

    sed -i "s/__UPSTREAM_PORT__/$APP_UPSTREAM_PORT/g" /opt/app/docker-compose.ha.yml
    sed -i "s#__HEALTH_PATH__#$APP_HEALTH_PATH#g" /opt/app/docker-compose.ha.yml

    # Nginx reverse proxy: listen on 3000 and inject a banner so the active server is visible without modifying app source.
    cat > /etc/nginx/conf.d/app.conf <<'NGINX'
    server {
      listen __PUBLIC_PORT__;
      server_name _;

      location / {
        proxy_pass http://127.0.0.1:__UPSTREAM_PORT__;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        sub_filter_once off;
        sub_filter_types text/html;
        sub_filter '</body>' '<div style="padding:6px 10px; font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f8f9fa; border-top:1px solid #dee2e6;">__BANNER_PREFIX__: <b>$hostname</b> ($server_addr)</div></body>';
      }
    }
    NGINX

    sed -i "s/__PUBLIC_PORT__/$APP_PUBLIC_PORT/g" /etc/nginx/conf.d/app.conf
    sed -i "s/__UPSTREAM_PORT__/$APP_UPSTREAM_PORT/g" /etc/nginx/conf.d/app.conf
    sed -i "s/__BANNER_PREFIX__/$BANNER_PREFIX/g" /etc/nginx/conf.d/app.conf

    nginx -t
    systemctl reload nginx

    cd /opt/app
    docker-compose -f docker-compose.ha.yml up -d --build --force-recreate

    echo "Waiting for app to become healthy..."
    for i in $(seq 1 60); do
      if curl -fsS "http://localhost:$APP_PUBLIC_PORT$APP_HEALTH_PATH" >/dev/null; then
        echo "App is healthy"
        exit 0
      fi
      sleep 5
    done

    echo "App did not become healthy" >&2
    docker ps || true
    exit 1
  EOF
  )

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  count = local.ha_enabled ? 1 : 0

  name                = "${var.environment}-app-asg"
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  desired_capacity    = var.asg_desired_capacity
  vpc_zone_identifier = [for s in aws_subnet.public : s.id]

  health_check_type         = "ELB"
  health_check_grace_period = 420

  target_group_arns = [aws_lb_target_group.app_tg[0].arn]

  launch_template {
    id      = aws_launch_template.app[0].id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"

    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 240
    }

    triggers = ["launch_template"]
  }

  tag {
    key                 = "Name"
    value               = "${var.environment}-app"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_policy" "cpu_target" {
  count = local.ha_enabled ? 1 : 0

  name                   = "${var.environment}-cpu-target"
  autoscaling_group_name = aws_autoscaling_group.app[0].name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}
