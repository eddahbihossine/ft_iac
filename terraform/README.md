Terraform scaffold for base networking, load balancing, DNS, SSL and optional CDN (AWS)

Assumptions
- AWS is the target cloud provider.
- You have AWS credentials available via environment (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) or an instance profile.
- You have a Route53 hosted zone and will provide the hosted zone ID and desired domain name.

What this creates
- VPC with public subnets and Internet Gateway
- Application Load Balancer (ALB) with HTTP listener and target group
- Route53 A record pointing to ALB (if `hosted_zone_id` and `domain_name` provided)
- ACM certificate (DNS-validated) for domain and validation records (if domain provided)
- Optional CloudFront distribution in front of the ALB (disabled by default)

How to use
1. Edit variables in `terraform/variables.tf` or pass via CLI/environment.
2. Initialize and plan:
   terraform init
   terraform plan -out=tfplan
3. Apply:
   terraform apply "tfplan"

Notes and next steps
- CloudFront custom certificate requires an ACM cert in us-east-1; the module currently creates regional cert for ALB. Set `enable_cloudfront = true` and provide a us-east-1 certificate if you want a custom domain on CloudFront.
- The ALB target group is created but no targets are registered — attach your ECS service or EC2 instances to the target group.
- Consider adding an S3 backend for remote state for team use.
