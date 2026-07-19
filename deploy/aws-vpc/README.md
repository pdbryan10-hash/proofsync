# ProofSync demo — self-contained AWS VPC

A single-tenant copy of the ProofSync demo that runs **entirely inside one AWS
VPC**, with its **own mirrored databases**. Nothing here touches the live Vercel
demo — this is a separate deployment you stand up in an AWS account you control.

## What it builds

```
                 Internet
                    │  HTTP :80
              ┌─────▼─────┐        VPC 10.20.0.0/16 (2 AZs)
              │    ALB    │  (public subnets)
              └─────┬─────┘
       ┌────────────▼────────────┐  private subnets
       │  Fargate: ProofSync app │  :3000  (direct transport — no Browserbase)
       └────────────┬────────────┘
                    │ mongodb://mongo.proofsync.local:27017 (?replicaSet=rs0)
       ┌────────────▼────────────┐
       │  Fargate: MongoDB (RS)  │  single-node replica set, data on EFS
       └─────────────────────────┘
   Secrets Manager · Cloud Map DNS · NAT · CloudWatch logs · EventBridge tick
```

One `DATABASE_URL` serves all three databases (Prisma's `see_cafm_sync` plus the
two stand-in demo DBs by name), so seeding the app mirrors the whole demo into the
in-VPC Mongo.

## Prerequisites

- AWS account + credentials (`aws configure`), permission to create VPC/ECS/etc.
- Terraform ≥ 1.5, Docker, and the AWS CLI.
- Region default is `eu-west-2` (London).

## Deploy — cloud build (recommended: no Docker, no AWS CLI, no admin)

Local tools needed: **Terraform + git only.** Terraform reads your AWS keys from
environment variables, uploads the source itself, and builds the images in AWS
CodeBuild. You click "Start build" in the browser. That's it.

```powershell
# --- set your AWS keys for this PowerShell session (from the IAM access key) ---
$env:AWS_ACCESS_KEY_ID     = "AKIA...your key id..."
$env:AWS_SECRET_ACCESS_KEY = "...your secret..."
$env:AWS_DEFAULT_REGION    = "eu-west-2"

# --- package the repo (clean — no node_modules), at the repo root -------------
cd C:\dev\sites\see-cafm-sync
git archive --format=zip -o source.zip HEAD

# --- create the build pipeline + upload the source ----------------------------
cd deploy\aws-vpc
cp terraform.tfvars.example terraform.tfvars      # keep tags at "v1"
terraform init
terraform apply -target=aws_codebuild_project.build -target=aws_s3_object.source
```

Now build the images (in the browser — no CLI):

1. AWS Console → **CodeBuild** → build project **`proofsync-demo-build`** →
   **Start build**. Wait ~5–10 min for **Succeeded**.

Then bring everything up:

```powershell
terraform apply
terraform output alb_url
```

To re-build later: re-run `git archive`, `terraform apply -target=aws_s3_object.source`
(re-uploads), then Start build again.

## Deploy — local Docker + AWS CLI (alternative)

If you'd rather build locally (needs Docker + the AWS CLI): because the ECS
services can't start until images exist, create the **ECR repos first**, push
images, then apply the rest.

```bash
cd deploy/aws-vpc
cp terraform.tfvars.example terraform.tfvars     # set app_image_tag / mongo_image_tag
terraform init

# 1) create just the two image repos
terraform apply -target=aws_ecr_repository.app -target=aws_ecr_repository.mongo

# 2) log in to ECR
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=$(terraform output -raw region)
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

APP_REPO=$(terraform output -raw ecr_app_repository_url)
MONGO_REPO=$(terraform output -raw ecr_mongo_repository_url)

# 3) build + push the app image (build context = repo root)
docker build -t "$APP_REPO:v1" ../..
docker push "$APP_REPO:v1"

# 4) build + push the mongo image
docker build -t "$MONGO_REPO:v1" ./mongo
docker push "$MONGO_REPO:v1"

# 5) apply everything (tags must match tfvars)
terraform apply

# 6) get the URL
terraform output alb_url
```

Give the app a couple of minutes to become healthy behind the ALB (Mongo initiates
its replica set on first boot).

## Mirror the databases (one-time seed)

The in-VPC Mongo starts empty. Seed the demo into it by hitting the reset endpoint
with the write key:

```bash
URL=$(terraform output -raw alb_url)
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id proofsync-demo-app-env \
  --query SecretString --output text | jq -r .CRON_SECRET)

curl -X POST "$URL/api/demo/reset" -H "Authorization: Bearer $SECRET"
```

Open `"$URL"` → the homepage; `"$URL/demo"` → the closed-loop demo (press **Run**).

> Strictness (optional): the demo's own indexes are created on seed. If you want
> Prisma's `see_cafm_sync` unique indexes enforced too, run `npx prisma db push`
> once against the cluster (via ECS Exec on the app task, or a bastion) — not
> required for the demo to work.

## Notes / decisions

- **Direct transport** (`DEMO_TRANSPORT=direct`) — the sync runs over the DB, so
  no Browserbase and no Chromium in the image. Everything stays in the VPC.
- **Single-node Mongo replica set** — Prisma's Mongo connector needs a replica
  set; one node satisfies it and keeps the demo self-contained. Data persists on
  EFS, advertised under Cloud Map DNS so the app resolves it across restarts.
- **The live build is untouched** — the app image uses `next start` (not the
  standalone output), so `next.config` is unchanged and the Vercel demo is
  unaffected.
- **Not production-hardened as-is**: HTTP only (add an ACM cert + `:443` listener
  and a DNS name for TLS), one NAT gateway, single-AZ Mongo. Fine for a demo;
  layer HA/TLS on for a real client tenancy.

## Tear down

```bash
terraform destroy
```
