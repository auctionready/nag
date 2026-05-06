# Nag infrastructure (Pulumi, TypeScript)

AWS deployment for the Nag backend: API Gateway HTTP API → Lambda (`dotnet10`, arm64) → **Neon serverless PostgreSQL** (engine 17). The Neon connection URI and the device-token signing secret are injected into the Lambda as KMS-encrypted environment variables — no managed NAT Gateway, no AWS Secrets Manager, no VPC.

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

The DB connection string and device-token signing secret are passed as Lambda environment variables (`DATABASE_URL`, `DEVICE_TOKEN_SECRET`), encrypted at rest with the AWS-managed KMS key — see `backend/Nag.Api/Infrastructure/LambdaSecrets.cs`. `DATABASE_URL` is the Neon `connection_uri` (a `postgres://user:pass@host/db?sslmode=require` URI); `LambdaSecrets` parses it into Npgsql `key=value` form and forces `SSL Mode=Require`.

Neon's compute scales to zero after `neonSuspendTimeoutSeconds` of idle (default = Neon account default, ~5 min on Free). First query after a long idle pays a ~500 ms warm-up.

## How the DB connection reaches the Lambda

`infra/src/database.ts` declares a single Neon resource: `neon.Project`, with the default branch + role + database + endpoint configured inline. The provider exposes `project.connectionUri` as a Pulumi secret output — that value is wired straight into the Lambda's `DATABASE_URL` env var.

There are deliberately no separate `neon.Role` / `neon.Database` resources. Those used to be branch-pinned, which made a Neon "restore from snapshot" (which promotes a new branch ID) try to replace them. Modeling only the project keeps state branch-agnostic: a console restore refreshes `connectionUri` to the new branch on the next `pulumi up` and nothing else moves.

To rotate the password out-of-band (e.g. via Neon console), run `pulumi up` afterwards — `connectionUri` is recomputed from the project on every refresh.

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

The `@pulumi/neon` SDK lives under `sdks/neon/` and is committed (see [`sdks/SDKS.md`](./sdks/SDKS.md) for why). To bump the provider, run `pulumi package add terraform-provider kislerdm/neon` from `infra/` and commit the regenerated SDK + the resulting `package.json` / `package-lock.json` changes.

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

## Rotating the device-token secret

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
    database.ts           # neon.Project — exposes connectionUri
    api.ts                # Lambda + API Gateway + log group + IAM
    domain.ts             # ACM cert + API Gateway custom domain + Route 53 alias (optional)
    migrations.ts         # command.local that runs db-apply after deploy
  Pulumi.yaml             # project (pins the neon bridge plugin version)
  Pulumi.prod.yaml        # prod stack config
  sdks/neon/              # generated @pulumi/neon SDK (committed — see sdks/SDKS.md)
```

## Migrating an existing stack from `pulumi-neon` to `@pulumi/neon`

The repo previously used the older `pulumi-neon` npm package and modeled `neon.Project` + `neon.Role` + `neon.Database` as three separate resources, with a custom REST fetch for the password. The new shape uses a single `neon.Project` and reads `connectionUri` directly. Existing stacks need a one-shot state migration; new stacks just need `npm ci` and a normal `pulumi up`.

For each existing stack (e.g. `prod`):

1. **List the existing neon resources in state**

   ```bash
   pulumi stack --stack prod --show-urns | grep neon
   ```

   Expect four URNs: a `pulumi:providers:neon` provider, a `neon:index/project:Project`, a `neon:index/role:Role`, and a `neon:index/database:Database`. Copy them — the next steps use the exact strings.

2. **Drop the Role, Database, Project, and old Provider from state**

   The Role and Database stay in Neon (live database keeps them) — we're only removing them from Pulumi's bookkeeping so the next `up` doesn't try to delete them. The Project is dropped because the new `@pulumi/neon` (bridged via `pulumi-resource-terraform-provider`) is bound to a different provider plugin than the old `pulumi-resource-neon`; easiest fix is delete + re-import. The old Provider falls out once nothing references it.

   ```bash
   pulumi state delete --stack prod 'urn:pulumi:prod::nag::neon:index/role:Role::nag'
   pulumi state delete --stack prod 'urn:pulumi:prod::nag::neon:index/database:Database::nag'
   pulumi state delete --stack prod 'urn:pulumi:prod::nag::neon:index/project:Project::nag'
   pulumi state delete --stack prod 'urn:pulumi:prod::nag::pulumi:providers:neon::nag-neon'
   ```

3. **Re-import the Project under the new provider**

   ```bash
   # Project ID from Neon Console → Settings → General (e.g. damp-recipe-88779456).
   pulumi import --stack prod neon:index/project:Project nag <project-id>
   ```

   Pulumi will print a generated `new neon.Project(...)` block. Diff it against `infra/src/database.ts` — `orgId`, `regionId`, `pgVersion`, `branch.{name,roleName,databaseName}`, and `defaultEndpointSettings` should already match. If they don't, reconcile the code before continuing.

4. **`pulumi preview --stack prod`**

   The only diffs should be on the Lambda: `DB_HOST`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` removed, `DATABASE_URL` added. Expect **no replacement** of the Neon project, no recompute of the endpoint, and no DB downtime. Anything else — stop and investigate.

5. **`pulumi up --stack prod`**. The Lambda redeploys with the new env shape; Marten reconnects on the next request.
