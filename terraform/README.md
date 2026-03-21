Terraform scaffold for base networking, load balancing, DNS, SSL and optional CDN (AWS)

Assumptions
- AWS is the target cloud provider.
- You authenticate with the standard AWS credential chain on the machine running Terraform, for example AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS_PROFILE, AWS SSO, or an instance role.
- You have an SSH key pair on the machine running Terraform and will pass its paths via `ssh_public_key_path` and `ssh_private_key_path`.
- You have a Route53 hosted zone and will provide the hosted zone ID and desired domain name.

What this creates
- VPC with public subnets and Internet Gateway
- Application Load Balancer (ALB) with HTTP listener and target group
- HTTPS listener with ACM certificate and HTTP to HTTPS redirect when `domain_name` and `hosted_zone_id` are provided
- Route53 A record pointing to ALB (if `hosted_zone_id` and `domain_name` provided)
- ACM certificate (DNS-validated) for domain and validation records (if domain provided)
- Optional CloudFront distribution in front of the ALB (disabled by default)

How to use
1. Edit variables in `terraform/variables.tf` or pass via CLI/environment.
   - To target a specific AWS account via AWS CLI profile: set `AWS_PROFILE=<profile_name>` or pass `-var="aws_profile=<profile_name>"`.
   - Pass your local SSH key paths: `-var="ssh_public_key_path=~/.ssh/id_ed25519.pub" -var="ssh_private_key_path=~/.ssh/id_ed25519"`
2. Initialize and plan:
   terraform init
   terraform plan -out=tfplan -var="ssh_public_key_path=~/.ssh/id_ed25519.pub" -var="ssh_private_key_path=~/.ssh/id_ed25519"
3. Apply:
   terraform apply "tfplan"

Enable HTTPS
- Set `domain_name` to the public hostname you want to serve, for example `app.example.com`.
- Set `hosted_zone_id` to the Route53 hosted zone that manages that domain.
- After apply, Terraform will request an ACM certificate, create the DNS validation records, create an HTTPS listener on the ALB, and redirect HTTP traffic to HTTPS.

Example (new AWS account via profile)
- Configure your profile locally (outside this repo), then run:
  terraform init
   AWS_PROFILE=newacct terraform plan -out=tfplan -var="ssh_public_key_path=~/.ssh/id_ed25519.pub" -var="ssh_private_key_path=~/.ssh/id_ed25519"
  terraform apply "tfplan"

Notes and next steps
- CloudFront custom certificate requires an ACM cert in us-east-1; the module currently creates regional cert for ALB. Set `enable_cloudfront = true` and provide a us-east-1 certificate if you want a custom domain on CloudFront.
- The ALB target group is created but no targets are registered — attach your ECS service or EC2 instances to the target group.
- Consider adding an S3 backend with DynamoDB locking for shared state.
- The AWS identity running Terraform needs permissions for EC2, ELBv2, IAM, Route53, ACM, and optional CloudFront. A starter IAM policy is provided in `terraform-deployer-policy.json`.
- Commit the generated `.terraform.lock.hcl` file so all machines use the same provider versions.
