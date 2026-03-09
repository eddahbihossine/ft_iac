SUMMARY: Terraform scaffold for base networking, load balancing, DNS, SSL and optional CDN (AWS) — one-line summary: starter Terraform config to create VPC/subnets, ALB, DNS, TLS certs and optional CloudFront, targeting AWS.
ASSUMPTIONS: AWS is the target cloud provider — the code uses AWS-specific resources (Route53, ACM, CloudFront, aws_vpc, aws_lb) and is not directly portable to other clouds.
ASSUMPTIONS: You have AWS credentials available via environment (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) or an instance profile — Terraform needs valid AWS credentials to call AWS APIs.
ASSUMPTIONS: You have a Route53 hosted zone and will provide the hosted zone ID and desired domain name — DNS records and ACM DNS validation require an existing hosted zone.
WHAT THIS CREATES: VPC with public subnets and Internet Gateway — creates a VPC, public subnets, and an Internet Gateway to provide internet access where needed.
WHAT THIS CREATES: Application Load Balancer (ALB) with HTTP listener and target group — creates an ALB listening on HTTP and a target group for backend services (ECS tasks or EC2 instances).
WHAT THIS CREATES: Route53 A record pointing to ALB (if `hosted_zone_id` and `domain_name` provided) — creates a Route53 alias A record pointing your domain to the ALB when domain and zone are provided.
WHAT THIS CREATES: ACM certificate (DNS-validated) for domain and validation records (if domain provided) — requests an ACM TLS certificate and creates DNS validation records in Route53 when a domain is provided.
WHAT THIS CREATES: Optional CloudFront distribution in front of the ALB (disabled by default) — can create a CloudFront CDN to cache/accelerate content globally; disabled unless enabled via variables.
HOW TO USE: 1) Edit variables in `terraform/variables.tf` or pass via CLI/environment — set region, subnet CIDRs, domain, and flags either in the variables file, via `-var` flags, or `TF_VAR_` env vars.
HOW TO USE: 2) Initialize and plan: `terraform init` then `terraform plan -out=tfplan` — initialize providers and generate a plan saved to `tfplan` for review.
HOW TO USE: 3) Apply: `terraform apply "tfplan"` — apply the reviewed plan file to create resources.
NOTES AND NEXT STEPS: CloudFront custom certificate requires an ACM cert in us-east-1; the module currently creates regional cert for ALB — to use a custom domain on CloudFront create or provide an ACM cert in us-east-1 and reference it.
NOTES AND NEXT STEPS: The ALB target group is created but no targets are registered — attach your ECS service or EC2 instances to the target group so traffic is served by backends.
NOTES AND NEXT STEPS: Consider adding an S3 backend for remote state for team use — configure an S3 backend (with DynamoDB locking) to share state and prevent concurrent runs.