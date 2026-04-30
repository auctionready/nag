# Backend Architecture

The Nag backend is an ASP.NET Core 10 web API that the mobile client
talks to over HTTP. It's hosted on AWS Lambda in production and runs on
Kestrel locally — same codebase, no divergence.

The source lives in [`backend/`](../backend) and has its own
[README](../backend/README.md) for local-dev setup.

## Goals

1. **Durable event log.** The mobile app emits past-tense events
   locally (`packages/core/src/events/`) and ships them to the server
   via `POST /events`. The backend is the server-of-record so those
   events survive device loss and can sync to a future second device
   or web client.
2. **Pointer-driven sync.** The client tracks the last sequence number
   it has seen. After reconnecting (or on a fresh install) it pulls
   anything newer.
3. **Read-your-writes views.** A Marten _inline projection_ updates a
   `HomeBoard` document in the same transaction as the event append, so
   any client that reads `/home-board` immediately after a successful
   POST sees the change.

## Stack

| Concern       | Choice                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Runtime       | .NET 10 (LTS, GA on AWS Lambda since Jan 2026)                                                                     |
| Web framework | ASP.NET Core minimal APIs                                                                                          |
| Lambda bridge | `Amazon.Lambda.AspNetCoreServer.Hosting`                                                                           |
| Event store   | Marten 8 on Postgres 17                                                                                            |
| Messaging     | Wolverine 5 (registered for future async work)                                                                     |
| Read models   | Marten inline projections                                                                                          |
| Database      | Neon Serverless Postgres 17                                                                                        |
| Auth          | Static `Authorization: Bearer <key>` (single user, for now)                                                        |
| Logging       | Serilog → JSON console (CloudWatch picks up stdout)                                                                |
| Errors/traces | [Sentry.AspNetCore](https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/) — exceptions + distributed tracing |
| Validation    | FluentValidation                                                                                                   |
| Formatting    | CSharpier (pinned in `.config/dotnet-tools.json`)                                                                  |

## Endpoints

| Method | Path                                     | Auth | Notes                                                                          |
| ------ | ---------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `POST` | `/events`                                | yes  | Append the past-tense events for one user intent. Idempotent on envelope `id`. |
| `GET`  | `/events?since=<long>&limit=<int?>`      | yes  | Page of past-tense events; `limit` capped at 500.                              |
| `GET`  | `/sync?since=<long>`                     | yes  | Pull-sync: replay (events) or snapshot (HomeBoard).                            |
| `GET`  | `/home-board`                            | yes  | Materialized current-period view.                                              |
| `GET`  | `/check-ins/monthly/{year}/{month}`      | yes  | Materialized check-ins for one calendar month (UTC).                           |
| `GET`  | `/check-ins/weekly/{year}/{month}/{day}` | yes  | Materialized check-ins for one Sunday-anchored week. `day` = Sunday.           |
| `GET`  | `/health`                                | no   | Liveness.                                                                      |

In Debug builds, `/swagger` serves OpenAPI UI. In Release builds the
Swashbuckle package is conditionally excluded from the binary.

## Wire format

```jsonc
// POST /events body — one envelope per user intent, carrying the
// one-or-more past-tense events that intent produced.
{
  "id": "<uuid>", // client-generated; doubles as the idempotency key
  "timestamp": "2026-04-24T09:15:00Z",
  "events": [
    {
      "type": "HabitCreated", // discriminator from EventRegistry
      "payload": {
        /* event-specific fields */
      },
    },
  ],
}
```

Response:

```jsonc
{ "accepted": true,  "sequence": 42 }   // first time
{ "accepted": false, "sequence": 42 }   // duplicate id (replay)
```

```jsonc
// GET /events?since=0
{
  "events": [
    { "sequence": 1, "id": "...", "type": "HabitCreated", "timestamp": "...", "payload": { ... } },
    ...
  ],
  "nextSince": 500   // null when caught up
}
```

## Events & projection

`Nag.Core/Events/` defines the **past-tense fact** vocabulary the
client emits, the server validates and appends to Marten, and that
the server ships back to clients on `/events` and `/sync` replays.
Client and server share the vocabulary; the client emits events
locally for instant UI feedback while the dispatcher (`EventDispatcher`)
just validates and atomically appends what arrived. All events land
on a single stream per account; cross-account isolation is enforced
by Marten's conjoined tenancy on `account_id`.

`HomeBoardProjection` is a Marten `SingleStreamProjection<HomeBoard,
Guid>` registered with `ProjectionLifecycle.Inline`. Its `Apply(...)`
methods consume past-tense events and mutate the single `HomeBoard`
document, which roughly mirrors the home-screen UI shape:

```csharp
HomeBoard {
  Habits: [{
    Id, Title, Description?, Icon?,
    Goal: { Regularity, Frequency? },
    Schedules: [{ Hour, Minute, Days?, DayOfMonth?, Reminder }],
    PeriodCheckIns: [{ Id, Timestamp, Skipped }]   // current period only
  }]
}
```

Period scoping (which check-ins to include) is delegated to
`PeriodCalculator` so it can be unit-tested without Marten.

### Per-period check-in summaries

`MonthlyCheckInSummaryProjection` and `WeeklyCheckInSummaryProjection`
are `MultiStreamProjection<…, string>` projections, fan-out from the
same global event stream into one document per period. Doc ids are:

- Monthly: `"yyyy-MM"` (UTC, e.g. `"2026-04"`)
- Weekly: `"yyyy-MM-dd"` of the Sunday starting the week (UTC)

Each summary mirrors the `PeriodCheckIns` shape used in `HomeBoard`,
grouped by habit, so the mobile app can render historical periods
with the same UI it uses for the live board:

```csharp
MonthlyCheckInSummary { Id: "2026-04", MonthStart, Habits: [{ HabitId, CheckIns: [...] }] }
WeeklyCheckInSummary  { Id: "2026-04-26", WeekStart, Habits: [{ HabitId, CheckIns: [...] }] }
```

The mobile app holds only current + previous month's check-ins
locally (older rows are pruned after every successful pull-sync).
When the user browses history, the app calls
`GET /check-ins/{monthly|weekly}/…` to fill in the missing periods.

Cross-period correctness is now an invariant. `CheckInMoved` carries
both `OldTimestamp` and `NewTimestamp`, so the projection's slicer
fans out to **both** the source and target period docs via Marten's
`Identities` — the source removes the stale row, the target upserts
the new one. `CheckInDeleted` carries the timestamp at delete time
and routes cleanly to the right period. The
`CheckInIndexProjection` doc per check-in is no longer needed for
dispatcher state lookups (the client now carries `OldTimestamp` /
`Timestamp` in the events it emits) but is kept as a server-side
read model for diagnostic queries.

## Idempotency

Each `POST /events` envelope carries a client-generated `id` GUID.
Before appending, the dispatcher loads `ProcessedEnvelope { Id,
Sequence }` from Marten — if present, it returns the existing
sequence with `accepted: false` and does nothing. Otherwise it
appends each event in the envelope atomically + saves + records the
resulting sequence under the envelope id.

Net result: a client that retries a POST after a flaky network gets
the same `sequence` back; events are only appended once.

## Differences from the client schema

The client uses integer auto-increment ids (SQLite) for fast joins
locally; the server-shaped events carry GUIDs (`HabitId`,
`CheckInId` in event payloads, sourced from each row's `external_id`
column). Trade-off accepted because:

- offline-first creation works without a server round-trip;
- idempotency is straightforward;
- avoids id-reconciliation games when syncing across devices.

## Tests

xUnit, in `backend/Nag.Tests/`. Folders mirror source namespaces.

- `Core/Domain/PeriodCalculatorTests.cs` — pure unit tests (no DB).
- `Core/Validation/EventValidatorTests.cs` — FluentValidation rules.
- `Core/Projections/HomeBoardProjectionTests.cs` — drives the projection
  through Marten using a Testcontainers Postgres.
- `Api/EventsEndpointsTests.cs`, `Api/HomeBoardEndpointsTests.cs`,
  `Api/AuthTests.cs` — `WebApplicationFactory<Program>` + Testcontainers
  for end-to-end HTTP tests.

The Postgres 17 container is a shared collection fixture; each
integration test class uses a distinct schema for isolation.

## CI

`.github/workflows/ci.yml` adds a `backend` job that runs in parallel
with the existing client `check` / `build-app` / `test` jobs:
`dotnet csharpier check`, `dotnet build`, `dotnet test`.

## Deployment

Infrastructure is Pulumi (TypeScript) in [`infra/`](../infra), with a
one-time bootstrap stack in [`infra-bootstrap/`](../infra-bootstrap).
Region: `ap-southeast-2`. State backend: Pulumi Cloud.

Topology: API Gateway HTTP API → Lambda (`dotnet10`, arm64, no VPC) →
Neon Serverless Postgres 17. The DB connection details (host/db/user/
password) and the device-token signing secret are passed as
KMS-encrypted Lambda environment variables (`DB_HOST`, `DB_NAME`,
`DB_USERNAME`, `DB_PASSWORD`, `DEVICE_TOKEN_SECRET`,
`SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE`). On cold start,
[`LambdaSecrets.HydrateFromEnvironment`](../backend/Nag.Api/Infrastructure/LambdaSecrets.cs)
reads them and writes the connection string into `IConfiguration`.

The Lambda runs outside any VPC, so all outbound traffic — to Neon, to
Clerk's JWKS, to anywhere else — uses AWS-managed public networking with
no NAT instance / NAT Gateway / Hyperplane ENI in the path. Cold start
is ~half the in-VPC number. Clerk's JWKS is cached in-process by
`IConfigurationManager<OpenIdConnectConfiguration>`. Neon's compute
auto-suspends on idle (configurable via `nag:neonSuspendTimeoutSeconds`,
default = Neon account default); the first query after a long idle pays
a ~500 ms warm-up — much faster than Aurora Serverless v2's ~10–15 s wake.

Deploys run via
[`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml),
which assumes the `nag-github-deploy` role via GitHub OIDC and runs
`pulumi up`. Triggers: push to `main` touching `backend/**` or
`infra/**`, or manual dispatch.

See [`infra/README.md`](../infra/README.md) for first-time setup and
smoke tests.

## Observability — Sentry

The host wires [`Sentry.AspNetCore`](https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/)
in `Program.cs`: exceptions thrown from any endpoint or middleware are
captured automatically, and `app.UseSentryTracing()` records a
performance transaction per request. The mobile client already sends
`sentry-trace` / `baggage` headers
([`app/src/infrastructure/sentry.ts`](../app/src/infrastructure/sentry.ts)),
so backend spans nest under the originating mobile transaction in the
Sentry UI.

Serilog writes are bridged into Sentry via `Sentry.Serilog`:
`Information+` rides along as a breadcrumb, `Warning+` is captured as
a standalone Sentry event.

Configuration lives in the `Sentry` section of `appsettings.json` —
`TracesSampleRate` defaults to `0.1` in production and `1.0` in
development. The DSN is **never** committed; it is supplied at deploy
time via the `SENTRY_DSN` Lambda env var, which `LambdaSecrets`
forwards into `Sentry:Dsn`. When the var is unset (e.g. preview
stacks), the SDK starts in disabled mode and emits no network traffic.

Pulumi config:

```bash
pulumi config set --secret nag:sentryDsn 'https://...@oXXX.ingest.sentry.io/YYY'
# Optional override; defaults to the Pulumi stack name.
pulumi config set nag:sentryEnvironment prod
```

`SENTRY_RELEASE` is wired automatically to the SHA256 of the deployed
Lambda zip, so each deploy shows up as a distinct release on Sentry's
release health screen.
