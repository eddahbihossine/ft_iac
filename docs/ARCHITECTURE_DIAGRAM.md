# ft_IaC — Architecture Diagram (mandatory)

This diagram describes the deployed AWS architecture.

```mermaid
flowchart TB
  User((User)) -->|HTTPS| DNS[Route53 (optional)
A/AAAA alias]
  DNS --> CF[CloudFront (optional)
TLS cert in us-east-1]
  DNS --> ALB
  CF --> ALB[Application Load Balancer
:80/:443]

  ALB --> TG[Target Group
health check: /health/liveness]
  TG --> ASG[Auto Scaling Group
min>=2]

  subgraph AZs[Multiple AZs]
    ASG --> EC2A[EC2 instance A]
    ASG --> EC2B[EC2 instance B]
  end

  EC2A --> NginxA[Nginx reverse proxy
injects server-id banner]
  EC2B --> NginxB[Nginx reverse proxy
injects server-id banner]

  NginxA --> APIA[NestJS app (Docker)
:3000]
  NginxB --> APIB[NestJS app (Docker)
:3000]

  APIA --> RDS[(RDS MySQL
private subnets)]
  APIB --> RDS

  ASG -->|pull artifact| S3[(S3 artifacts bucket)]
  ASG -->|read secrets| SM[(Secrets Manager
RDS master password)]

  ALB --> CW[CloudWatch alarms]
  CW --> SNS[SNS email alerts (optional)]
```

Legend
- **CloudFront / Route53** are created only when `enable_cloudfront` / `domain_name` + `hosted_zone_id` are configured.
- **High availability** is achieved with an ALB + ASG and a minimum of 2 instances.
- **Shared data** is provided by MySQL (RDS in HA mode).
