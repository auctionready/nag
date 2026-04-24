# Nag infrastructure (Pulumi, TypeScript)

AWS deployment for the Nag backend: API Gateway HTTP API → Lambda (`dotnet10`, arm64) → Aurora PostgreSQL Serverless v2 (engine 17). DB password and API key are injected into the Lambda as KMS-encrypted environment variables — no NAT Gateway or AWS Secrets Manager.

State backend: **Pulumi Cloud**.
Region: **ap-southeast-2**.

## Architecture

```
Internet → API Gateway HTTP API ($default)
        → Lambda nag-api (VPC, private subnets, no internet egress)
        → Aurora PostgreSQL Serverless v2 (private subnets, auto-pauses when idle)
        → CloudWatch Logs /aws/lambda/nag-api (14-day retention, via Lambda-internal path)
```

The Lambda has no NAT Gateway and no VPC endpoints — it reaches Aurora over its Hyperplane ENI inside the private subnet, and log delivery is handled by the Lambda runtime (not the function's VPC networking). The DB password and API key are passed as Lambda environment variables (`DB_PASSWORD`, `API_KEY`), encrypted at rest with the AWS-managed KMS key — see `backend/Nag.Api/Infrastructure/LambdaSecrets.cs`.

Aurora is configured with `minCapacity: 0` and `secondsUntilAutoPause` (default 3000 s / 50 min) so the cluster scales to zero when idle. The first query after a long idle period pays a ~10–15 s warm-up.

## Prerequisites

1. AWS account, region `ap-southeast-2`, `aws-cli` configured locally (for first manual runs).
2. The **bootstrap stack** (`../infra-bootstrap`) has been applied once — it creates the GitHub OIDC provider and the `nag-github-deploy` role used by CI.
3. Pulumi CLI installed and `pulumi login` done (Pulumi Cloud).
4. Node 24 and `npm` available.
5. .NET 10 SDK (only needed when building the Lambda package locally).

## First-time setup

```bash
cd infra
npm ci
pulumi stack init prod
pulumi config set aws:region ap-southeast-2
pulumi config set --secret nag:apiKey <real-api-key>
pulumi config set --secret nag:dbPassword <strong-db-password>
# optional: pulumi config set nag:dbMinAcu 0.5     # keep a warm floor instead of auto-pause
# optional: pulumi config set nag:dbMaxAcu 2
# optional: pulumi config set nag:dbAutoPauseSeconds 3000
```

## Build the Lambda package

From the repo root:

```bash
dotnet tool install -g Amazon.Lambda.Tools   # once
cd backend/Nag.Api
dotnet lambda package \
  --configuration Release \
  --framework net10.0 \
  --function-architecture arm64 \
  --output-package ../../infra/artifacts/nag-api.zip
```

## Deploy

```bash
cd infra
pulumi up
```

On success, grab the invoke URL:

```bash
pulumi stack output invokeUrl
```

## Smoke tests

```bash
URL=$(pulumi stack output invokeUrl)
KEY=$(pulumi config get nag:apiKey --show-secrets)

curl -i "$URL/health"                                     # → 200 {"status":"ok"}
curl -i -H "Authorization: Bearer $KEY" "$URL/home-board" # → 200 JSON
curl -i -H "Authorization: Bearer wrong" "$URL/home-board" # → 401
```

## CI

`.github/workflows/deploy-backend.yml` builds the Lambda package, assumes `nag-github-deploy` via OIDC, and runs `pulumi up` on push to `main` (paths `backend/**`, `infra/**`) or manual dispatch.

Required GitHub repo **variable**: `AWS_DEPLOY_ROLE_ARN` (set by `infra-bootstrap`).
Required GitHub repo **secret**: `PULUMI_ACCESS_TOKEN`.

## Layout

```
infra/
  index.ts                # wires the modules
  src/
    config.ts             # typed stack-config accessor
    network.ts            # VPC, subnets (no NAT), SGs
    database.ts           # Aurora Serverless v2 cluster + writer (auto-pause)
    api.ts                # Lambda + API Gateway + log group + IAM
  Pulumi.yaml             # project
  Pulumi.prod.yaml        # prod stack config
```
