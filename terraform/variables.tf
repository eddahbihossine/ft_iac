variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-3"
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

variable "enable_cloudfront" {
  description = "Whether to create a CloudFront distribution in front of the ALB"
  type        = bool
  default     = false
}
