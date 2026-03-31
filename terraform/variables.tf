variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-3"
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

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
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
