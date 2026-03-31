terraform {
  required_version = ">= 1.1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
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
      filesha256("${path.module}/../.env.local"),
      filesha256("${path.module}/../package.json"),
      filesha256("${path.module}/../pnpm-lock.yaml"),
      filesha256("${path.module}/../tsconfig.json"),
      filesha256("${path.module}/../tsconfig.build.json"),
      filesha256("${path.module}/../nest-cli.json")
    ],
    [for file in sort(fileset("${path.module}/../src", "**")) : filesha256("${path.module}/../src/${file}")]
  )))
}

provider "aws" {
  region                  = var.aws_region
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

  # SSH
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ICMP (ping)
  ingress {
    description = "ICMP ping"
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP from ALB (app listens on 3000)
  ingress {
    description     = "App port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
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
  ami                         = "ami-05d43d5e94bb6eb95"
  instance_type               = "t3.micro"
  iam_instance_profile        = aws_iam_instance_profile.ssm_profile.name
  key_name                    = aws_key_pair.deployer.key_name
  subnet_id                   = aws_subnet.public["0"].id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  associate_public_ip_address = true

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
    DOCKER_COMPOSE_VERSION="v2.29.1"
    curl -SL "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    # Add swap so Docker builds are less likely to stall on small instances.
    fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
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
  depends_on = [aws_instance.example]

  triggers = {
    instance_id = aws_instance.example.id
    app_hash    = local.app_deploy_hash
  }

  connection {
    type        = "ssh"
    user        = "ec2-user"
    private_key = file(pathexpand(var.ssh_private_key_path))
    host        = aws_instance.example.public_ip
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

  provisioner "file" {
    source      = "${path.module}/../.env.local"
    destination = "/home/ec2-user/app/.env.local"
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
      "sudo docker-compose --env-file .env.local up -d --build --force-recreate",
      "echo 'Waiting for services to start...'",
      "sleep 30",
      "echo '=== Container status ==='",
      "sudo docker ps",
      "echo '=== Health check ==='",
      "curl -s -o /dev/null -w 'HTTP %%{http_code}' http://localhost:3000/health/liveness || echo 'App not ready yet (will be available shortly via ALB health checks)'",
    ]
  }
}

output "ec2_public_ip" {
  value = aws_instance.example.public_ip
}