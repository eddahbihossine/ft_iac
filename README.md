# IaC-1 Web App

## Description

Web app for the IaC-1 project.

## Installation

```bash
$ corepack enable
$ pnpm install --frozen-lockfile
```

## Deploy (AWS + Terraform)

Architecture diagram (for evaluation): `docs/ARCHITECTURE_DIAGRAM.md`.

This repo includes an interactive deploy CLI (`scripts/deploy.js`) that:
- lets you choose a region,
- generates (or reuses) an SSH keypair under `~/.ssh/` (no repo secrets),
- writes a per-environment/per-region tfvars file under `terraform/.deploy/` (gitignored),
- uses a Terraform workspace per environment+region (example: `dev-eu-west-3`),
- runs `terraform init/validate/plan/apply`.

Notes:
- `terraform apply` can take a while in `standard` mode (ALB/ASG/RDS). The deploy script streams Terraform output so you can see progress.
- If an EC2 key pair already exists, the deploy script will auto-`terraform import` it and retry once.
- If the artifacts bucket already exists, the deploy script will attempt to import/adopt it and retry once.

Run:
```bash
pnpm deploy
# or: pnpm run deploy
```

### Get the app URL (console)

After a successful apply, Terraform prints useful outputs at the end. You can also query them manually:

```bash
cd terraform
terraform workspace list
terraform workspace select dev-eu-west-3
terraform output -raw app_endpoint
```

### Destroy (interactive)

Use the interactive destroy CLI to remove everything provisioned by the deploy script for one workspace or all workspaces found in `terraform/.deploy`:

```bash
pnpm destroy
# or: pnpm run destroy
```

### Destroy (manual dev/prod)

Destroy is per workspace. Example (Paris / `eu-west-3`):

```bash
cd terraform
terraform workspace select dev-eu-west-3
terraform destroy -auto-approve -var-file=.deploy/dev-eu-west-3.tfvars

terraform workspace select prod-eu-west-3
terraform destroy -auto-approve -var-file=.deploy/prod-eu-west-3.tfvars
```

## Running the app

### Development environment

**Run the app in development mode**
```bash
pnpm start
```

**Or with watch mode**
```bash
pnpm start:dev
```

### Production environment

```bash
pnpm build
pnpm start:prod
```

## Environment Variables

Files to store environment variables in:
* `.env`
* `.env.local`
* `.env.example` contains a safe template for new machines

### App
* **PORT** = port to run the app on
* **NODE_ENV** = environment to run the app in (if not "production", database can be erased)

### Database
* **MYSQL_HOST** = hostname of the database
* **MYSQL_PORT** = port of the database
* **MYSQL_USER** = username of the database
* **MYSQL_PASSWORD** = password of the database
* **MYSQL_DATABASE** = name of the database
* **DB_INIT_SYNC** = to sync the database on startup (if "true", database can be erased) (value : "true" or "false")

### Logs

* **LOG_LEVEL** = Log level logged by logger
(Possibilities in order of importance : `error`,`warn`,`info`,`http`,`verbose`,`debug` ou `silly`)
(See **Winston** log levels: https://www.npmjs.com/package/winston#logging-levels)
(Default: `verbose`)

* **LOG_DIRECTORY** = Folder where log files will be written (by default, logs are written in the current directory in `logs`)

### Tests E2E

* **TEST_AUTO_RUN_SERVER** = to run the server automatically before running the tests (value : "true" or "false")
* **TEST_HOST** = hostname of the app to test (default: "http://localhost:3000")
* **TEST_USERNAME** = username to use on the app to test (default: "toto")

## Test

### Unit tests

Unit tests are written with **Jest** and can be run without application running or application environment (database, ...).

**Command to run unit tests**
```bash
pnpm test
```

**Command to run unit tests with watch mode**
```bash
pnpm test:watch
```

### E2E tests

E2E tests are written with **Playwright** and can't be run without application running or application environment (database, ...).

**Command to run headless E2E tests**
```bash
pnpm test:e2e
```

**Command to run E2E tests with browser**
```bash
pnpm test:e2e:ui
```

## Tooling

- Node.js 18 is the expected runtime. Use your version manager of choice to match it.


## Stack
* Node.js
* TypeScript
* Express.js
* Nest
* Jest
* Playwright

## Defense / Evaluation Checklist (Presentation Script)

This section mirrors the content of `DEFENSE_CHECKLIST_PRESENTATION.txt` so the evaluator can run the defense directly from this README.

### How to use this section
- This is a talk track + demo script aligned to the official checklist.
- For each item: explain **what** it is, show **where** it is in the repository, and demo **how** it works.

### 0) Preliminary rules (evaluator)
- Defense only with student/group present (knowledge sharing).
- If repository is missing required files or wrong structure → stop (grade 0).
- Evaluator clones the repo on their machine and deploys from scratch.

### 1) General decisions (IaC tool + Cloud provider)

#### IaC tool used: Terraform
- Location: `terraform/*.tf`
- Why Terraform: declarative, reproducible, supports AWS primitives (VPC/ALB/ASG/RDS/Route53/ACM/CloudFront).

#### Cloud provider used: AWS
- Why AWS: broad service coverage, clean HA primitives (ALB/ASG), Route53/ACM integration, managed RDS, CloudWatch/SNS for alerting.

#### Deployment “pipeline platform”
- This project uses an interactive deploy CLI instead of CI: `scripts/deploy.js`
- Why: evaluator can deploy without student intervention (region selection, workspace naming, tfvars generation, safe retry/adopt flows).

### 2) Cloud infrastructure (mandatory)

#### 2.1 Distributed application / Multiple servers (mandatory)
- Requirement: app must run on at least 2 separate servers (HA).
- Evidence:
	- ASG + Launch Template: `terraform/asg.tf`
	- Minimum enforced when `enable_alb=true`: `terraform/variables.tf` (checks)
- Demo:
	1. AWS console → EC2 → Auto Scaling Groups → verify Desired/Min >= 2.
	2. Show at least two InService instances.

#### 2.2 “Which server handled my page?” (mandatory)
- Requirement: user can identify which server served the page.
- Evidence:
	- Nginx injects a banner with `$hostname` and `$server_addr`:
		- `terraform/asg.tf` (user_data → `/etc/nginx/conf.d/app.conf`)
- Demo:
	1. Open app URL.
	2. Scroll to page bottom: banner shows server hostname.
	3. Open Incognito and refresh; often a different hostname appears.

#### 2.3 Preserving authentication on refresh (mandatory)
- Requirement: user remains logged in after multiple refreshes.
- Evidence:
	- App stores logged-in user in session: `src/login/login.controller.ts`
	- Session middleware: `src/main.ts`
	- Session persistence across instances: MySQL-backed session store via `express-mysql-session`
- Demo:
	1. Login.
	2. Refresh 10+ times: still logged in.
	3. Optional: use a second browser profile and login; both remain authenticated.

#### 2.4 Shared data (mandatory)
- Requirement: data created on one instance is visible from another quickly.
- Evidence:
	- Shared persistence via MySQL:
		- TypeORM MySQL config: `src/app.module.ts`
		- HA mode uses RDS MySQL: `terraform/database.tf`
	- Data entities in DB:
		- `src/todos/entities/todo.entity.ts`
		- `src/users/entities/user.entity.ts`
- Demo:
	1. Create a todo.
	2. Open another browser profile (likely another instance) and verify todo is visible immediately.

#### 2.5 High availability (mandatory)
- Requirement: app stays available after deleting one instance; recovers after deleting all.
- Evidence:
	- ALB health checks + `health_check_type=ELB`: `terraform/asg.tf`, `terraform/alb.tf`
	- Rolling instance refresh configured: `terraform/asg.tf`
- Demo:
	1. Terminate one EC2 instance in ASG.
	2. App remains reachable.
	3. ASG launches replacement.
	4. Optional: terminate all instances; ASG recreates and ALB becomes healthy again.

#### 2.6 Scalability (mandatory)
- Requirement: scale out when CPU/RAM load is high.
- Evidence:
	- Target tracking autoscaling policy (CPU 60%): `terraform/asg.tf` (`aws_autoscaling_policy.cpu_target`)
- Demo:
	1. Generate load (e.g., `hey`/`wrk`) against app endpoint.
	2. Show CloudWatch ASG metrics rising.
	3. Show ASG desired capacity increasing.

#### 2.7 Cost management (mandatory)
- Requirement: reasonable instance/DB sizes + dev cost-minimizing config.
- Evidence:
	- Sizing knobs: `terraform/locals.tf` (small/medium/large mappings)
	- Cost profile toggle: `terraform/variables.tf` (`cost_profile` free vs standard)
- Demo:
	1. Show `cost_profile="free"` disables ALB/CloudFront/RDS.
	2. Show `cost_profile="standard"` enables full HA stack.

#### 2.8 Security (mandatory)
- Requirement: DB not public; no repo secrets; no plaintext secrets in startup script/provider console.
- Evidence:
	- RDS private: `publicly_accessible=false` in `terraform/database.tf`
	- DB security group allows only app SG: `terraform/database.tf`
	- DB password AWS-managed (Secrets Manager): `manage_master_user_password=true` in `terraform/database.tf`
	- Instances read secret at runtime via IAM role policy: `terraform/asg.tf`
	- State/artifacts gitignored: `.gitignore`
- Demo:
	1. RDS console: verify “Public access: No”.
	2. Confirm no secrets committed (no `terraform.tfstate*`, no `.env*`).

#### 2.9 Alerts / Monitoring (mandatory)
- Requirement: admin gets alerted if app unhealthy / 5XX.
- Evidence:
	- SNS topic + email subscription + CloudWatch alarms: `terraform/alerts.tf`
- Demo:
	1. Provide `alert_email` in config.
	2. Confirm SNS subscription email.
	3. Trigger alarm (e.g., stop all targets briefly) and show alert email.

### 3) Infrastructure as Code (mandatory)

#### 3.1 Modularity
- Requirement: not all code in one file; reusable logical blocks.
- Evidence:
	- Terraform split by concern:
		- `terraform/vpc.tf`
		- `terraform/alb.tf`
		- `terraform/asg.tf`
		- `terraform/database.tf`
		- `terraform/alerts.tf`
		- `terraform/cloudfront.tf`
		- `terraform/acm_and_dns.tf`

#### 3.2 Region selection (friendly)
- Requirement: use simple names (EU/Paris), not only `eu-west-3`.
- Evidence:
	- Region map in `terraform/locals.tf`
	- Deploy CLI reads that map: `scripts/deploy.js`

#### 3.3 Selecting server & DB capacity (friendly)
- Requirement: small/medium/large selection.
- Evidence:
	- `terraform/locals.tf` (`server_instance_type_by_size`, `db_instance_class_by_size`)

#### 3.4 Re-configurable centralized static values
- Requirement: central place to modify values; redeploy updates infrastructure.
- Evidence:
	- `terraform/locals.tf` and `terraform/variables.tf` centralize mappings and overrides.
	- Changing size/class mappings updates infra after `apply`.

### 4) Documentation & accessibility (mandatory)

#### 4.1 Diagram present
- Requirement: at least one diagram describing infrastructure.
- Evidence:
	- `docs/ARCHITECTURE_DIAGRAM.md` (Mermaid diagram)

#### 4.2 Accessible deployment
- Requirement: evaluator can deploy without student intervention.
- Evidence:
	- Deployment instructions in this README
	- Interactive deploy CLI: `scripts/deploy.js`
- Demo:
	1. On clean machine: `corepack enable && pnpm i`
	2. Run: `pnpm deploy`
	3. Script creates workspace + tfvars and runs init/plan/apply.

### 5) Cheat checks (mandatory)

#### 5.1 No external Terraform modules
- Requirement: no prefabricated Terraform modules from registry/GitHub.
- Evidence:
	- No `module` blocks in `terraform/*.tf`; only native resources.

#### 5.2 No orchestrator managing a cluster
- Requirement: no Kubernetes/Nomad.
- Evidence:
	- Infrastructure uses EC2 + ALB + ASG.
	- Docker Compose is used only locally per instance.

#### 5.3 No PaaS usage
- Requirement: do not run app on PaaS (Beanstalk/ECS/Fargate/AppRunner/etc.).
- Evidence:
	- IaaS approach: EC2 + ALB + ASG.
	- DB on RDS (managed DB is allowed by project statement).

#### 5.4 No malicious modified application
- Requirement: app not altered to mislead evaluator.
- Evidence:
	- Server-ID banner shows real Nginx `$hostname` and `$server_addr` (not hard-coded).

### Suggested live defense flow (10–15 minutes)
1. Show diagram (`docs/ARCHITECTURE_DIAGRAM.md`).
2. Show deploy command (`pnpm deploy`).
3. Show multiple instances + banner proof.
4. Login + refresh.
5. Create todo in one browser and verify from another.
6. Terminate an instance and show availability + replacement.
7. Show autoscaling policy + test method.
8. Show security posture + `terraform/alerts.tf`.

### Common Q&A (short)
- Why AWS? Tight ALB/ASG/ACM/Route53 integration + managed RDS.
- Why Terraform? Reproducible infrastructure and easy environment toggles.
- How is auth preserved? Express sessions stored in MySQL, valid from any instance.
- How is shared data implemented? Central MySQL (RDS) used by all app instances.
- How is HA guaranteed? ASG min=2 + ALB health checks + automatic replacement.
- How is scaling done? TargetTrackingScaling on ASGAverageCPUUtilization.