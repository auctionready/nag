# Nag Backend

ASP.NET Core 10 web API on top of Marten (event store + projections) and
Wolverine, hosted on AWS Lambda in production and Kestrel locally — same
codebase, no divergence.

See [`docs/Backend.md`](../docs/Backend.md) for the architecture overview.

## Layout

- **`Nag.Core`** — domain types, commands, projections, validators, handlers.
- **`Nag.Api`** — ASP.NET Core host, endpoints, auth middleware, Lambda
  bridge.
- **`Nag.Tests`** — xUnit. `Core/` tests mirror source namespaces; `Api/`
  uses `WebApplicationFactory` + Testcontainers Postgres for end-to-end
  HTTP tests.

## Local development

Requires .NET 10 SDK and Docker.

```bash
# 1. Start a local Postgres
docker compose up -d

# 2. Restore the local CSharpier tool
dotnet tool restore

# 3. Set the device-token signing secret. Either copy the example
#    dotenv file once and edit it, or export inline.
cp .env.example .env.local
# then edit .env.local — generate a value with:
#   openssl rand -base64 48

# 4. Run
dotnet run --project Nag.Api
# → http://localhost:5266/swagger (Debug builds only)
```

`appsettings.Development.json` ships a placeholder secret so the host
boots without any extra config; override it with your own value via
`.env.local` or `Nag__DeviceToken__Secret` in the environment (note the
`__` double underscore that .NET config uses to separate JSON sections).

There is **no shared API key** anymore — protected endpoints require
either a per-device HMAC token or a Clerk JWT. The simplest way to
exercise a protected endpoint is to register a device first:

```bash
DEVICE_ID=$(uuidgen | tr 'A-Z' 'a-z')

# Anonymous registration → response includes a fresh deviceToken.
TOKEN=$(curl -s -X POST http://localhost:5266/devices/register \
  -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"label\":\"local\"}" \
  | jq -r .deviceToken)

curl -H "Authorization: Bearer $TOKEN" http://localhost:5266/home-board
```

In Swagger UI, paste that `deviceToken` value into the **Authorize**
dialog (the lock icon at the top of the page) to send it on every
"Try it out" request automatically.

## Tests

```bash
dotnet test
```

Integration tests start an ephemeral Postgres 17 container via
Testcontainers, so they need a running Docker daemon. Pure unit tests can
be filtered:

```bash
dotnet test --filter 'FullyQualifiedName~Domain|FullyQualifiedName~Validation'
```

## Formatting

[CSharpier](https://csharpier.com) is pinned in
`.config/dotnet-tools.json`. Format the tree:

```bash
dotnet csharpier format .
```

`dotnet csharpier check .` runs in CI; the lefthook `pre-commit` hook
runs the same on staged `*.cs` files.

## OpenAPI

In Debug builds the host serves Swagger UI and the OpenAPI document at
`http://localhost:5266/swagger`. To regenerate the spec on disk without
running the server (used by the `@nag/api-client` codegen):

```bash
pnpm openapi          # writes ../packages/api-client/openapi.json
pnpm openapi:check    # regenerates and fails if the committed file drifts
```

Under the hood this is `dotnet swagger tofile` from
[Swashbuckle.AspNetCore.Cli](https://github.com/domaindrivendev/Swashbuckle.AspNetCore),
pinned in `.config/dotnet-tools.json`. It loads the built
`Nag.Api.dll`, asks the in-process Swagger provider for the document,
and exits — no Postgres, no Kestrel bind. Custom filters in
`Nag.Api/OpenApi/` (the command discriminated union, enum casing) are
preserved as-is because the CLI runs the same Swashbuckle pipeline as
the live `/swagger` endpoint.

## Deployment

The host is wired for AWS Lambda via
`AddAWSLambdaHosting(LambdaEventSource.HttpApi)`. When the process runs
under Lambda, ASP.NET Core requests are bridged from API Gateway HTTP
API events; everywhere else (`dotnet run`, integration tests) the same
binary runs under Kestrel.

Infrastructure-as-code lives in [`infra/`](../infra) (Pulumi / TypeScript)
and is deployed by the **Deploy backend** GitHub Actions workflow.

Production assumes:

- AWS Lambda with the managed `dotnet10` runtime (GA Jan 2026)
- [Neon](https://neon.tech) Serverless Postgres 17, auto-suspend on
- DB connection string and the device-token signing secret passed as
  Lambda environment variables (`DATABASE_URL`, `DEVICE_TOKEN_SECRET`)
  — see `Nag.Api/Infrastructure/LambdaSecrets.cs`. `DATABASE_URL` is
  the Neon `connection_uri` (a `postgres://user:pass@host/db?sslmode=require`
  URI); `LambdaSecrets` parses it into Npgsql key=value form.
- Sentry DSN passed as `SENTRY_DSN` (plus optional `SENTRY_ENVIRONMENT`
  / `SENTRY_RELEASE`); when unset the SDK initializes in disabled mode

### Database migrations

Marten in production runs with `AutoCreateSchemaObjects = AutoCreate.None`
so the Lambda doesn't pay the pg_catalog introspection cost on every cold
start. Schema changes therefore have to be applied out-of-band — Pulumi
wires `scripts/apply-db-migrations.sh` as a `command.local.Command`
resource (see [`infra/src/migrations.ts`](../infra/src/migrations.ts))
that runs after the Neon DB and the Lambda code are in place, and
re-fires whenever the Lambda zip hash or `DATABASE_URL` changes. The
underlying `db-apply` JasperFx command is idempotent, so re-running is
safe.

To run it manually against a non-prod DB:

```bash
DATABASE_URL='postgres://nag:nag@localhost/nag' \
  ./scripts/apply-db-migrations.sh
```
