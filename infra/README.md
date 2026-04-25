# Nag infrastructure (Pulumi, TypeScript)

AWS deployment for the Nag backend: API Gateway HTTP API → Lambda (`dotnet10`, arm64) → Aurora PostgreSQL Serverless v2 (engine 17). The DB password and the device-token signing secret are injected into the Lambda as KMS-encrypted environment variables — no managed NAT Gateway, no AWS Secrets Manager.

State backend: **Pulumi Cloud**.
Region: **ap-southeast-2**.

## Architecture

```
Internet → API Gateway HTTP API ($default)
        → Lambda nag-api (VPC, private subnets)
        → Aurora PostgreSQL Serverless v2 (private subnets, auto-pauses when idle)
        → CloudWatch Logs /aws/lambda/nag-api (14-day retention, via Lambda-internal path)

Lambda outbound (Clerk JWKS only) → NAT instance (t4g.nano, fck-nat AMI, single AZ) → Internet
```

The Lambda reaches Aurora over its Hyperplane ENI inside the private subnet, and log delivery is handled by the Lambda runtime (not the function's VPC networking). The DB password and the device-token signing secret are passed as Lambda environment variables (`DB_PASSWORD`, `DEVICE_TOKEN_SECRET`), encrypted at rest with the AWS-managed KMS key — see `backend/Nag.Api/Infrastructure/LambdaSecrets.cs`.

Outbound internet (a few KB to Clerk's `/.well-known/openid-configuration` + JWKS, cached in-process) is served by a single `t4g.nano` NAT instance running the [fck-nat](https://fck-nat.dev/) community AMI, in one public subnet. This costs ~US$3/mo vs ~US$33/mo for a managed NAT Gateway. Tradeoff: if the NAT instance or its AZ goes down, Clerk-protected endpoints (`/accounts/upgrade`, `/devices/pair`) fail until it's replaced; everything else (health checks, anonymous registration, device-token endpoints) keeps working. See [`src/nat.ts`](./src/nat.ts) for the full caveats list and the recipe for switching back to a managed NAT Gateway.

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
pulumi config set --secret nag:deviceTokenSecret "$(openssl rand -base64 48)"
pulumi config set --secret nag:dbPassword <strong-db-password>
# optional: pulumi config set nag:dbMinAcu 0.5     # keep a warm floor instead of auto-pause
# optional: pulumi config set nag:dbMaxAcu 2
# optional: pulumi config set nag:dbAutoPauseSeconds 3000
# optional: pulumi config set nag:clerkIssuer https://your-instance.clerk.accounts.dev
# optional: custom domain (set both, or neither)
# pulumi config set nag:hostedZoneName example.com
# pulumi config set nag:apiDomainName  api.example.com
```

### Rotating the device-token secret

The signing secret is the trust root for every issued device token. To
rotate (e.g. on suspected compromise, or as periodic hygiene):

```bash
cd infra
pulumi config set --secret nag:deviceTokenSecret "$(openssl rand -base64 48)" --stack prod
pulumi up --stack prod
```

After the new Lambda environment is live, every previously-issued
device token fails HMAC verification → mobile clients get 401 → they
hit `/devices/register` (anonymous) and receive a fresh token signed
by the new secret. There is no separate revocation list.

### Migrating from the legacy `nag:apiKey`

Stacks deployed before phase 2c carry a `nag:apiKey` entry that is no
longer read by the backend. Drop it after the stack is on the new
auth model:

```bash
pulumi config rm nag:apiKey --stack prod
```

## Custom domain (optional)

If `nag:hostedZoneName` and `nag:apiDomainName` are both set, Pulumi will:

1. Request an ACM certificate (regional, in `ap-southeast-2`) for the subdomain.
2. Look up the existing Route 53 public hosted zone by name (read-only — the zone itself is **not** managed by Pulumi).
3. Create the DNS validation record, wait for ACM validation, and bind the cert to an API Gateway v2 custom domain (`REGIONAL`, `TLS_1_2`).
4. Map the custom domain → API Gateway stage, and add an A-record alias at `nag:apiDomainName` pointing at the regional API Gateway endpoint.

The stack output `apiUrl` always exists: it's the friendly `https://<subdomain>/` when the custom domain is configured, and the raw `https://<id>.execute-api.<region>.amazonaws.com/` invoke URL otherwise. The raw invoke URL is also exposed separately as `invokeUrl` for diagnostics.

## Bind an EAS build to this backend

After `pulumi up` succeeds, push `apiUrl` into the EAS environment that
an `eas.json` build profile reads from:

```bash
ops/sync-eas-env.sh <pulumi-stack> <eas-environment>
# e.g. ops/sync-eas-env.sh prod preview     # preview build → prod backend
# e.g. ops/sync-eas-env.sh prod production  # prod build    → prod backend
```

The script sets `NAG_API_BASE_URL` (plaintext) in the named EAS
environment. Mobile clients no longer ship a build-time API key —
each device registers anonymously on first launch via
`POST /devices/register` and stores the returned `deviceToken` in
SecureStore. Re-run the script if the backend moves to a different
URL (e.g. behind a new custom domain).

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
DEVICE_ID=$(uuidgen | tr 'A-Z' 'a-z')

curl -i "$URL/health"                                       # → 204

# Anonymous registration → response includes a fresh deviceToken.
TOKEN=$(curl -s -X POST "$URL/devices/register" \
  -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"label\":\"smoke\"}" \
  | jq -r .deviceToken)

curl -i -H "Authorization: Bearer $TOKEN"  "$URL/home-board" # → 200
curl -i -H "Authorization: Bearer wrong"   "$URL/home-board" # → 401
curl -i                                    "$URL/home-board" # → 401
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
    network.ts            # VPC, public + private subnets, SGs
    nat.ts                # NAT instance (t4g.nano, fck-nat) — cost-minimized egress
    database.ts           # Aurora Serverless v2 cluster + writer (auto-pause)
    api.ts                # Lambda + API Gateway + log group + IAM
    domain.ts             # ACM cert + API Gateway custom domain + Route 53 alias (optional)
  Pulumi.yaml             # project
  Pulumi.prod.yaml        # prod stack config
```
