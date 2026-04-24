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

# 3. Run
dotnet run --project Nag.Api
# → http://localhost:5266/swagger (Debug builds only)
```

The default API key in `appsettings.json` is `dev-only-replace-me`.
Override via the `NAG__APIKEY` environment variable (note the double
underscore separating section from key).

```bash
export NAG__APIKEY="your-key"
curl -H "Authorization: Bearer $NAG__APIKEY" http://localhost:5266/home-board
```

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

## Deployment (planned)

The host is wired for AWS Lambda via
`AddAWSLambdaHosting(LambdaEventSource.HttpApi)`. When the process runs
under Lambda, ASP.NET Core requests are bridged from API Gateway HTTP
API events; everywhere else (`dotnet run`, integration tests) the same
binary runs under Kestrel.

Infrastructure-as-code (CDK / SAM / Terraform) is intentionally not
included yet — track that work in GitHub Issues.

Production assumes:

- AWS Lambda with the managed `dotnet10` runtime (GA Jan 2026)
- Amazon RDS for PostgreSQL Serverless v2 (Postgres 17), auto-pause on
- DB password and API key passed as KMS-encrypted Lambda environment
  variables (`DB_PASSWORD`, `API_KEY`) — see
  `Nag.Api/Infrastructure/LambdaSecrets.cs`
