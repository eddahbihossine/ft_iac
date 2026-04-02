terraform {
  required_version = ">= 1.1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4"
    }
    external = {
      source  = "hashicorp/external"
      version = ">= 2.3"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
  }
}

locals {
  app_deploy_hash = sha256(join("", concat(
    [
      filesha256("${path.module}/../docker-compose.yml"),
      filesha256("${path.module}/../dockerfile"),
      filesha256("${path.module}/../package.json"),
      filesha256("${path.module}/../pnpm-lock.yaml"),
      filesha256("${path.module}/../tsconfig.json"),
      filesha256("${path.module}/../tsconfig.build.json"),
      filesha256("${path.module}/../nest-cli.json")
    ],
    [for file in sort(fileset("${path.module}/../src", "**")) : filesha256("${path.module}/../src/${file}")]
  )))

  # Single-EC2 mode uses Terraform provisioners (SSH). If ssh_ingress_cidr is not set,
  # fall back to the public IP of the machine running Terraform.
  ssh_ingress_cidr_effective = length(trimspace(var.ssh_ingress_cidr)) > 0 ? var.ssh_ingress_cidr : (
    var.enable_alb ? "" : try("${data.external.runner_public_ip[0].result.ip}/32", "")
  )
}

provider "aws" {
  region                  = local.selected_region
  profile                 = var.aws_profile
  skip_metadata_api_check = true
}

# Provider alias for us-east-1 (required for CloudFront ACM certificates)
provider "aws" {
  alias                   = "us_east_1"
  region                  = "us-east-1"
  profile                 = var.aws_profile
  skip_metadata_api_check = true
}

data "external" "runner_public_ip" {
  count = var.enable_alb ? 0 : (length(trimspace(var.ssh_ingress_cidr)) > 0 ? 0 : 1)

  program = [
    "bash",
    "-lc",
    "ip=$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]'); printf '{\"ip\":\"%s\"}' \"$ip\"",
  ]
}

resource "aws_iam_role" "ssm_role" {
  name = "${var.environment}-ssm-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm_profile" {
  name = "${var.environment}-ssm-profile"
  role = aws_iam_role.ssm_role.name
}

resource "aws_key_pair" "deployer" {
  key_name   = var.ssh_key_name
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_security_group" "ec2_sg" {
  name        = "${var.environment}-ec2-sg"
  description = "Allow SSH, ICMP, and HTTP from ALB"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = length(trimspace(local.ssh_ingress_cidr_effective)) > 0 ? [1] : []
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [local.ssh_ingress_cidr_effective]
    }
  }

  # ICMP (ping)
  ingress {
    description = "ICMP ping"
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.enable_alb ? [1] : []
    content {
      description     = "App port from ALB"
      from_port       = var.app_public_port
      to_port         = var.app_public_port
      protocol        = "tcp"
      security_groups = [aws_security_group.alb_sg[0].id]
    }
  }

  dynamic "ingress" {
    for_each = var.enable_alb ? [] : [1]
    content {
      description = "App port (direct)"
      from_port   = var.app_public_port
      to_port     = var.app_public_port
      protocol    = "tcp"
      cidr_blocks = [var.public_app_ingress_cidr]
    }
  }

  # All outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.environment}-ec2-sg" }
}

resource "aws_security_group" "alb_sg" {
  count       = var.enable_alb ? 1 : 0
  name        = "${var.environment}-alb-sg"
  description = "Allow HTTP inbound to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.environment}-alb-sg" }
}

resource "aws_instance" "example" {
  count = var.enable_alb ? 0 : 1

  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = local.selected_server_instance_type
  iam_instance_profile        = aws_iam_instance_profile.ssm_profile.name
  key_name                    = aws_key_pair.deployer.key_name
  subnet_id                   = aws_subnet.public["0"].id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = local.selected_server_root_volume_gb
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -ex
    exec > /var/log/user-data.log 2>&1

    # Install Docker
    yum update -y
    yum install -y docker git
    systemctl start docker
    systemctl enable docker

    # Install Docker Compose
    DOCKER_COMPOSE_VERSION="${var.docker_compose_version}"
    curl -SL "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    # Add swap so Docker builds are less likely to stall on small instances.
    fallocate -l ${var.swap_size_gb}G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$(( ${var.swap_size_gb} * 1024 ))
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Signal that Docker setup is complete
    touch /home/ec2-user/.docker-ready
  EOF

  tags = { Name = "${var.environment}-ec2" }
}

resource "null_resource" "app_deploy" {
  count      = var.enable_alb ? 0 : 1
  depends_on = [aws_instance.example]

  triggers = {
    instance_id = aws_instance.example[0].id
    app_hash    = local.app_deploy_hash
  }

  connection {
    type        = "ssh"
    user        = "ec2-user"
    private_key = file(pathexpand(var.ssh_private_key_path))
    host        = aws_instance.example[0].public_ip
    timeout     = "5m"
  }

  provisioner "remote-exec" {
    inline = [
      "mkdir -p /home/ec2-user/app",
      "rm -rf /home/ec2-user/app/src",
    ]
  }

  provisioner "file" {
    source      = "${path.module}/../docker-compose.yml"
    destination = "/home/ec2-user/app/docker-compose.yml"
  }

  provisioner "file" {
    source      = "${path.module}/../dockerfile"
    destination = "/home/ec2-user/app/dockerfile"
  }

  provisioner "remote-exec" {
    inline = [
      <<-EOC
      set -eu

      APP_DIR="/home/ec2-user/app"
      ENV_FILE="$APP_DIR/.env.local"

      MYSQL_ROOT_PASSWORD_INPUT='${var.mysql_root_password}'
      MYSQL_PASSWORD_INPUT='${var.mysql_password}'

      ensure_rand() {
        tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
      }

      # If secrets are provided via TF_VAR_*, prefer them.
      # Otherwise, generate once on the instance and reuse across re-applies.
      if [ -n "$MYSQL_ROOT_PASSWORD_INPUT" ] || [ -n "$MYSQL_PASSWORD_INPUT" ]; then
        MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD_INPUT"
        MYSQL_PASSWORD="$MYSQL_PASSWORD_INPUT"

        if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
          MYSQL_ROOT_PASSWORD="$(ensure_rand)"
        fi
        if [ -z "$MYSQL_PASSWORD" ]; then
          MYSQL_PASSWORD="$(ensure_rand)"
        fi

        cat > "$ENV_FILE" <<ENV
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=${var.mysql_database}
MYSQL_USER=${var.mysql_user}
MYSQL_PASSWORD=$MYSQL_PASSWORD

MYSQL_HOST=localhost
MYSQL_PORT=${var.mysql_port}

DB_INIT_SYNC=true
ENV
      else
        if [ -f "$ENV_FILE" ]; then
          echo "Reusing existing $ENV_FILE"
        else
          MYSQL_ROOT_PASSWORD="$(ensure_rand)"
          MYSQL_PASSWORD="$(ensure_rand)"

          cat > "$ENV_FILE" <<ENV
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=${var.mysql_database}
MYSQL_USER=${var.mysql_user}
MYSQL_PASSWORD=$MYSQL_PASSWORD

MYSQL_HOST=localhost
MYSQL_PORT=${var.mysql_port}

DB_INIT_SYNC=true
ENV
        fi
      fi

      chmod 600 "$ENV_FILE"
      EOC
    ]
  }

  provisioner "file" {
    source      = "${path.module}/../package.json"
    destination = "/home/ec2-user/app/package.json"
  }

  provisioner "file" {
    source      = "${path.module}/../pnpm-lock.yaml"
    destination = "/home/ec2-user/app/pnpm-lock.yaml"
  }

  provisioner "file" {
    source      = "${path.module}/../tsconfig.json"
    destination = "/home/ec2-user/app/tsconfig.json"
  }

  provisioner "file" {
    source      = "${path.module}/../tsconfig.build.json"
    destination = "/home/ec2-user/app/tsconfig.build.json"
  }

  provisioner "file" {
    source      = "${path.module}/../nest-cli.json"
    destination = "/home/ec2-user/app/nest-cli.json"
  }

  provisioner "file" {
    source      = "${path.module}/../src"
    destination = "/home/ec2-user/app"
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Waiting for Docker to be ready...'",
      "while [ ! -f /home/ec2-user/.docker-ready ]; do sleep 2; done",
      "sleep 5",
      "cd /home/ec2-user/app",
      "cp -f dockerfile Dockerfile",
      "sudo docker-compose --env-file .env.local up -d --build --force-recreate",
      "echo 'Waiting for services to start...'",
      "sleep 30",
      "echo '=== Container status ==='",
      "sudo docker ps",
      "echo '=== Health check ==='",
      "curl -s -o /dev/null -w 'HTTP %%{http_code}' http://localhost:${var.app_public_port}${var.app_health_path} || echo 'App not ready yet (will be available shortly via ALB health checks)'",
    ]
  }
}

output "ec2_public_ip" {
  value = var.enable_alb ? "" : aws_instance.example[0].public_ip
}