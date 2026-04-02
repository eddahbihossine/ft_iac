variable "aws_region" {
  description = "Advanced override: deploy region identifier (e.g. eu-west-3). Prefer region_choice for friendly selection. Leave empty to use region_choice."
  type        = string
  default     = ""
}

variable "cost_profile" {
  description = "Cost profile: 'free' keeps the stack within AWS Free Tier assumptions (no ALB/CloudFront/Route53/RDS). 'standard' enables the full stack."
  type        = string
  default     = "free"
}

variable "enable_alb" {
  description = "Whether to create an Application Load Balancer (paid). In free mode this must be false."
  type        = bool
  default     = false
}

variable "region_choice" {
  description = "Friendly region selector (e.g. 'Paris', 'EU', 'Ireland', 'Frankfurt', 'Virginia')."
  type        = string
  default     = "Paris"
}

variable "aws_profile" {
  description = "Optional AWS shared config profile name to use for authentication (e.g. 'newacct'). If null, Terraform uses the default AWS credential chain."
  type        = string
  default     = null
}

variable "ssh_key_name" {
  description = "Name of the EC2 key pair created for Terraform deployments"
  type        = string
  default     = "terraform-deployer"
}

variable "ssh_public_key_path" {
  description = "Path to the public SSH key used to create the EC2 key pair"
  type        = string

  validation {
    condition     = length(trimspace(var.ssh_public_key_path)) > 0
    error_message = "Set ssh_public_key_path to a public key file accessible from the machine running Terraform."
  }
}

variable "ssh_private_key_path" {
  description = "Path to the private SSH key used by Terraform provisioners to connect to the EC2 instance"
  type        = string

  validation {
    condition     = length(trimspace(var.ssh_private_key_path)) > 0
    error_message = "Set ssh_private_key_path to a private key file accessible from the machine running Terraform."
  }
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH into instances (used for the single-EC2 mode provisioning). Prefer a single /32 for your IP. Leave empty to disable SSH ingress."
  type        = string
  default     = ""
}

variable "public_app_ingress_cidr" {
  description = "CIDR allowed to reach the app directly when enable_alb=false (single-EC2 mode)."
  type        = string
  default     = "0.0.0.0/0"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
}

variable "server_size" {
  description = "Friendly server capacity tier: small | medium | large."
  type        = string
  default     = "small"
}

variable "server_instance_type_override" {
  description = "Advanced override: EC2 instance type (e.g. t3.micro). Leave empty to use server_size."
  type        = string
  default     = ""
}

variable "enable_database" {
  description = "Whether to create a managed database instance (RDS MySQL)."
  type        = bool
  default     = false
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for the managed database (higher availability, higher cost)."
  type        = bool
  default     = false
}

variable "db_size" {
  description = "Friendly database capacity tier: small | medium | large. Used only when enable_database = true."
  type        = string
  default     = "small"
}

variable "db_instance_class_override" {
  description = "Advanced override: RDS instance class (e.g. db.t3.micro). Leave empty to use db_size."
  type        = string
  default     = ""
}

variable "db_name" {
  description = "Database name (enable_database = true)."
  type        = string
  default     = "app"
}

variable "db_username" {
  description = "Database username (enable_database = true)."
  type        = string
  default     = "app"
}

variable "db_password" {
  description = "Database password (enable_database = true)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "mysql_root_password" {
  description = "Single-EC2 mode only: optional MySQL root password for the local MySQL container. If empty, a strong password is generated on the EC2 instance and persisted there (do not commit secrets)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "mysql_user" {
  description = "Single-EC2 mode only: MySQL app username for the local MySQL container."
  type        = string
  default     = "user"
}

variable "mysql_password" {
  description = "Single-EC2 mode only: optional MySQL app password for the local MySQL container. If empty, a strong password is generated on the EC2 instance and persisted there (do not commit secrets)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "mysql_database" {
  description = "Single-EC2 mode only: MySQL database name for the local MySQL container."
  type        = string
  default     = "todo_app"
}

variable "mysql_port" {
  description = "Single-EC2 mode only: MySQL port used by the app (inside Docker network)."
  type        = number
  default     = 3306
}

variable "db_port" {
  description = "Managed DB port. For MySQL this is typically 3306."
  type        = number
  default     = 3306
}

variable "app_public_port" {
  description = "Public-facing application port on the instance/ALB target group (HA: Nginx listens on this port; single-EC2: app binds to this port)."
  type        = number
  default     = 3000
}

variable "app_upstream_port" {
  description = "Upstream port on the instance that Nginx proxies to in HA mode (the app container is published on this host port)."
  type        = number
  default     = 3001
}

variable "app_health_path" {
  description = "HTTP path used for health checks (ALB + instance bootstrap)."
  type        = string
  default     = "/health/liveness"
}

variable "docker_compose_version" {
  description = "Docker Compose v2 version installed on instances."
  type        = string
  default     = "v2.29.1"
}

variable "swap_size_gb" {
  description = "Swap size (GiB) created on instances to reduce OOM risk during Docker builds."
  type        = number
  default     = 1
}

variable "server_identity_banner_prefix" {
  description = "Label shown in the injected server identity banner (HA mode)."
  type        = string
  default     = "Served by"
}

variable "asg_min_size" {
  description = "Auto Scaling Group min size when enable_alb=true. Must be >= 2 to satisfy the HA requirement."
  type        = number
  default     = 2
}

variable "asg_desired_capacity" {
  description = "Auto Scaling Group desired capacity when enable_alb=true. Must be >= 2 to satisfy the HA requirement."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Auto Scaling Group max size when enable_alb=true."
  type        = number
  default     = 4
}

variable "artifact_bucket_name" {
  description = "Optional S3 bucket name to store the application artifact zip. Leave empty to auto-generate a name."
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Email address for alerts (SNS subscription). Leave empty to disable email alerts."
  type        = string
  default     = ""
}

variable "alert_target_5xx_threshold" {
  description = "Alarm threshold for ALB target 5XX count per period. Used when alert_email is set."
  type        = number
  default     = 1
}

variable "alert_period_seconds" {
  description = "CloudWatch alarm period in seconds. Used when alert_email is set."
  type        = number
  default     = 300
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "List of private subnet CIDRs (used for managed database subnets)."
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID where DNS records will be created"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Fully qualified domain name for the service (eg app.example.com)"
  type        = string
  default     = ""
}

check "tls_dns_inputs" {
  assert {
    condition = (
      length(trimspace(var.domain_name)) == 0 &&
      length(trimspace(var.hosted_zone_id)) == 0
      ) || (
      length(trimspace(var.domain_name)) > 0 &&
      length(trimspace(var.hosted_zone_id)) > 0
    )
    error_message = "Set both domain_name and hosted_zone_id together to enable SSL/DNS, or leave both empty."
  }
}

check "friendly_selectors" {
  assert {
    condition     = contains(["small", "medium", "large"], lower(trimspace(var.server_size)))
    error_message = "server_size must be one of: small, medium, large."
  }

  assert {
    condition     = contains(["small", "medium", "large"], lower(trimspace(var.db_size)))
    error_message = "db_size must be one of: small, medium, large."
  }
}

check "cost_profile_valid" {
  assert {
    condition     = contains(["free", "standard"], lower(trimspace(var.cost_profile)))
    error_message = "cost_profile must be 'free' or 'standard'."
  }
}

check "free_profile_guardrails" {
  assert {
    condition = lower(trimspace(var.cost_profile)) != "free" || (
      var.enable_alb == false &&
      var.enable_cloudfront == false &&
      length(trimspace(var.domain_name)) == 0 &&
      length(trimspace(var.hosted_zone_id)) == 0 &&
      var.enable_database == false &&
      length(trimspace(var.alert_email)) == 0 &&
      lower(trimspace(var.server_size)) == "small"
    )
    error_message = "Free mode requires: enable_alb=false, enable_cloudfront=false, no domain_name/hosted_zone_id, enable_database=false, alert_email empty, and server_size='small'."
  }
}


check "cloudfront_requires_alb" {
  assert {
    condition     = !var.enable_cloudfront || var.enable_alb
    error_message = "enable_cloudfront requires enable_alb=true (CloudFront origin is the ALB)."
  }
}

check "ha_requires_two_instances" {
  assert {
    condition     = !var.enable_alb || (var.asg_min_size >= 2 && var.asg_desired_capacity >= 2)
    error_message = "When enable_alb=true (HA mode), set asg_min_size and asg_desired_capacity to at least 2."
  }
}

check "ha_requires_database" {
  assert {
    condition     = !var.enable_alb || var.enable_database
    error_message = "When enable_alb=true (HA mode), enable_database must be true to provide shared state across instances."
  }
}

variable "enable_cloudfront" {
  description = "Whether to create a CloudFront distribution in front of the ALB"
  type        = bool
  default     = false
}

variable "alb_name" {
  description = "Optional explicit ALB name. Leave empty to use a safe default that avoids common name collisions."
  type        = string
  default     = ""
}

variable "target_group_name" {
  description = "Optional explicit ALB target group name. Leave empty to use a safe default that avoids common name collisions."
  type        = string
  default     = ""
}
