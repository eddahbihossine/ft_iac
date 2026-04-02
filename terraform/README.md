Terraform scaffold for base networking, load balancing, DNS, SSL and optional CDN (AWS)

Assumptions
- AWS is the target cloud provider.
- You authenticate with the standard AWS credential chain on the machine running Terraform, for example AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS_PROFILE, AWS SSO, or an instance role.
- You have an SSH key pair on the machine running Terraform and will pass its paths via `ssh_public_key_path` and `ssh_private_key_path`.
- You have a Route53 hosted zone and will provide the hosted zone ID and desired domain name.

What this creates
- VPC with public subnets and Internet Gateway
- Application Load Balancer (ALB) with HTTP listener and target group
- Auto Scaling Group (ASG) of EC2 instances (min 2) when `enable_alb = true`
- HTTPS listener with ACM certificate and HTTP to HTTPS redirect when `domain_name` and `hosted_zone_id` are provided and `enable_cloudfront = false`
- Optional CloudFront distribution in front of the ALB (disabled by default), with HTTPS and us-east-1 ACM certificate when `domain_name` and `hosted_zone_id` are provided
- Route53 A record pointing to ALB or CloudFront (if `hosted_zone_id` and `domain_name` provided)
- Optional managed database (RDS MySQL) in private subnets when `enable_database = true`

How to use
1. Recommended: create a user config file (no code edits)
   - Copy `config.auto.tfvars.json.example` to `config.auto.tfvars.json`.
   - Edit only the values (region, sizes, alert email, DB settings, SSH key paths).
   - Terraform automatically loads `*.auto.tfvars.json` files.
2. Initialize and plan:
   terraform init
   terraform plan -out=tfplan
3. Apply:
   terraform apply "tfplan"

Friendly selectors (root-level)
- `region_choice`: choose a friendly name like `Paris` or `EU` instead of `eu-west-3`.
- `server_size`: `small | medium | large` mapped to EC2 instance types.
- `enable_database` + `db_size`: optional RDS MySQL with `small | medium | large` sizing.
- `alert_email`: optional SNS email alerts (e.g. ALB target 5XX alarm).

Security and secrets
- SSH is disabled by default. Single-EC2 mode uses Terraform provisioners (SSH), so either set `ssh_ingress_cidr` to your public IP (a `/32`) or leave it empty and Terraform will auto-detect your current public IP and allow SSH from it.
- The single-EC2 mode no longer relies on a committed `.env.local`. If you do not provide `TF_VAR_mysql_root_password` / `TF_VAR_mysql_password`, strong passwords are generated on the EC2 instance and persisted there.
- The managed DB uses an AWS-managed master password (stored in Secrets Manager), so you do not need to put DB passwords in tfvars.

Cost profiles
- `cost_profile = "free"` (default): strict free-trial mode.
   - Disables paid components: `enable_alb=false`, `enable_cloudfront=false`, no `domain_name/hosted_zone_id`, `enable_database=false`, and no `alert_email`.
   - App is reachable directly on `http://<ec2_public_ip>:3000`.
- `cost_profile = "standard"`: enables the full stack when you intentionally turn on ALB/CloudFront/DNS/DB.

Enable HTTPS
- Set `domain_name` to the public hostname you want to serve, for example `app.example.com`.
- Set `hosted_zone_id` to the Route53 hosted zone that manages that domain.
- For ALB-only HTTPS, keep `enable_cloudfront = false`. Terraform will request a regional ACM certificate, create DNS validation records, create an HTTPS listener on the ALB, and redirect HTTP traffic to HTTPS.
- For CloudFront HTTPS, set `enable_cloudfront = true`. Terraform will request an ACM certificate in `us-east-1`, validate it via Route53, attach it to CloudFront, and point DNS to CloudFront.

Example (new AWS account via profile)
- Configure your profile locally (outside this repo), then run:
  terraform init
   AWS_PROFILE=newacct terraform plan -out=tfplan -var="ssh_public_key_path=~/.ssh/id_ed25519.pub" -var="ssh_private_key_path=~/.ssh/id_ed25519"
  terraform apply "tfplan"

Notes and next steps
- With `enable_alb = true`, targets are registered automatically via the ASG.
- Consider an S3 backend with DynamoDB locking for shared state (recommended if you treat state as sensitive).
- The AWS identity running Terraform needs permissions for EC2, ELBv2, IAM, Route53, ACM, and optional CloudFront. A starter IAM policy is provided in `terraform-deployer-policy.json`.
- Commit the generated `.terraform.lock.hcl` file so all machines use the same provider versions.
