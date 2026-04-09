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