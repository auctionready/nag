# Nag infrastructure (Pulumi, TypeScript)

AWS deployment for the Nag backend: API Gateway HTTP API → Lambda (`dotnet10`, arm64) → **Neon serverless PostgreSQL** (engine 17). The DB password (provisioned by Neon) and the device-token signing secret are injected into the Lambda as KMS-encrypted environment variables — no managed NAT Gateway, no AWS Secrets Manager, no VPC.

State backend: **Pulumi Cloud**.
Region: **ap-southeast-2** (Lambda + API Gateway). Neon project lives in `aws-ap-southeast-2` for in-region latency.

## Architecture

```
Internet → API Gateway HTTP API ($default)
        → Lambda nag-api (no VPC — direct AWS-managed egress)
        → Neon PostgreSQL (public endpoint, TLS-only, scale-to-zero)
        → CloudWatch Logs /aws/lambda/nag-api (14-day retention)
```

The Lambda runs outside any VPC, so all outbound traffic — to Neon, to Clerk's JWKS, to anywhere else — uses AWS-managed public networking with no NAT instance / NAT Gateway / Hyperplane ENI in the path. Cold start is ~half the in-VPC number.

The DB password and device-token signing secret are passed as Lambda environment variables (`DB_PASSWORD`, `DEVICE_TOKEN_SECRET`), encrypted at rest with the AWS-managed KMS key — see `backend/Nag.Api/Infrastructure/LambdaSecrets.cs`. The Npgsql connection string forces `SSL Mode=Require` so the in-flight Neon traffic is always TLS.

Neon's compute scales to zero after `neonSuspendTimeoutSeconds` of idle (default = Neon account default, ~5 min on Free). First query after a long idle pays a ~500 ms warm-up — much faster than Aurora Serverless v2's ~10–15 s wake.

## Prerequisites

1. AWS account, region `ap-southeast-2`, `aws-cli` configured locally (for first manual runs).
2. The **bootstrap stack** (`../infra-bootstrap`) has been applied once — it creates the GitHub OIDC provider and the `nag-github-deploy` role used by CI.
3. Pulumi CLI installed and `pulumi login` done (Pulumi Cloud).
4. Node 24 and `npm` available.
5. .NET 10 SDK (only needed when building the Lambda package locally).
6. A Neon account + API key (Console → Account Settings → API Keys).

## First-time setup

```bash
cd infra
npm ci
pulumi stack init prod
pulumi config set aws:region ap-southeast-2
pulumi config set --secret nag:neonApiKey <neon-api-key>
pulumi config set --secret nag:deviceTokenSecret "$(openssl rand -base64 48)"
# optional Neon overrides:
# pulumi config set nag:neonRegionId aws-ap-southeast-2
# pulumi config set nag:neonMinCu 0.25
# pulumi config set nag:neonMaxCu 1
# pulumi config set nag:neonSuspendTimeoutSeconds 0   # 0 = Neon default
# pulumi config set nag:clerkIssuer https://your-instance.clerk.accounts.dev
# optional: custom domain (set both, or neither)
# pulumi config set nag:hostedZoneName example.com
# pulumi config set nag:apiDomainName  api.example.com
```

The `pulumi-neon` npm SDK ships TypeScript bindings; the Pulumi runtime resolves the corresponding `pulumi-resource-neon` plugin binary from the bundled provider package. If `pulumi up` cannot find the plugin, install it with:

```bash
pulumi plugin install resource neon 0.2.0
```

### Migrating data from Aurora to Neon

The Pulumi diff that introduces the Neon project does **not** copy data. To cut over a populated Aurora cluster:

```bash
# 1. Snapshot Aurora (point-in-time, while the cluster is awake).
pg_dump --format=custom --no-owner --no-privileges \
        --host <aurora-endpoint> --username nag --dbname nag \
        --file nag.dump

# 2. Provision the Neon project (run once before the cutover).
pulumi up

# 3. Restore into Neon. Connection details come from the stack outputs +
#    the `nag-neon` role password (a Pulumi secret).
NEON_HOST=$(pulumi stack output dbEndpoint)
NEON_PASSWORD=$(pulumi stack output --show-secrets dbPassword)   # add this output if you need it
PGPASSWORD=$NEON_PASSWORD pg_restore --no-owner --no-privileges \
  --host "$NEON_HOST" --username nag --dbname nag --clean --if-exists \
  nag.dump
```

In a maintenance window: pause writes, snapshot, restore, run `pulumi up` to switch the Lambda env vars, smoke-test, then destroy the Aurora cluster + VPC + NAT instance from the _previous_ stack state (the new stack no longer references those resources, so `pulumi up` already removed them — verify with `pulumi stack` and `aws ec2 describe-vpcs`).

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

### Rotating the Neon role password

Neon assigns the role password at create time and exposes it as a
Pulumi secret output. To rotate, taint the role and re-run `up`:

```bash
pulumi state delete 'urn:pulumi:prod::nag::neon:index/role:Role::nag'
pulumi up
```

The role is recreated with a fresh password and the Lambda env var
`DB_PASSWORD` updates in the same deploy.

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
environment.

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
    database.ts           # Neon project + branch endpoint + role + database
    api.ts                # Lambda + API Gateway + log group + IAM
    domain.ts             # ACM cert + API Gateway custom domain + Route 53 alias (optional)
  Pulumi.yaml             # project
  Pulumi.prod.yaml        # prod stack config
```
