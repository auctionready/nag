using JasperFx;
using JasperFx.Events.Projections;
using Marten;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Core.Idempotency;
using Nag.Core.Projections;
using Nag.Core.ReadModels;
using Wolverine.Http.Marten;

namespace Nag.Api.Configuration;

public static class MartenExtensions
{
    public static WebApplicationBuilder AddNagMarten(this WebApplicationBuilder builder)
    {
        var connectionString =
            builder.Configuration.GetConnectionString("Nag")
            ?? throw new InvalidOperationException("ConnectionStrings:Nag is not configured.");

        var schemaName = builder.Configuration["Nag:SchemaName"];
        var isProduction = builder.Environment.IsProduction();

        builder
            .Services.AddMarten(opts =>
            {
                opts.Connection(connectionString);
                if (!string.IsNullOrWhiteSpace(schemaName))
                {
                    opts.DatabaseSchemaName = schemaName;
                    opts.Events.DatabaseSchemaName = schemaName;
                }
                opts.Events.StreamIdentity = JasperFx.Events.StreamIdentity.AsGuid;

                // Per-account isolation. Conjoined tenancy tags every event row with
                // a `tenant_id`; documents flagged below get the same column. The
                // `IDocumentSession` injected into authenticated handlers is already
                // tenanted by Wolverine HTTP (see `opts.TenantId.IsClaimTypeNamed`
                // below), so every existing `session.Events.Append(NagStreams.Root, …)`
                // and `session.LoadAsync<HomeBoard>(NagStreams.Root, …)` automatically
                // scopes to the calling account.
                //
                // `Account` and `Device` stay single-tenant on purpose: they're how
                // we *find* the tenant in the first place (sub → account, deviceId
                // → device), so they have to be queryable without a tenant context.
                opts.Events.TenancyStyle = Marten.Storage.TenancyStyle.Conjoined;

                // Skip per-cold-start pg_catalog introspection in production. Schema
                // changes are applied out-of-band (one-shot migration), so the Lambda
                // can assume the schema already matches.
                if (isProduction)
                {
                    opts.AutoCreateSchemaObjects = AutoCreate.None;
                }

                // The server appends only past-tense events. Every event type
                // the client may emit must be registered with Marten.
                foreach (var t in EventRegistry.All)
                {
                    opts.Events.AddEventType(t);
                }

                // Register every document type the API stores or loads, so that
                // `db-apply` (which we run out-of-band; see `infra/src/migrations.ts`)
                // can plan their tables. With AutoCreate.None, Marten doesn't
                // auto-discover documents on first use, so any unregistered type
                // would 5xx with a missing-relation error.
                opts.Schema.For<Account>();
                opts.Schema.For<Device>();
                opts.Schema.For<ProcessedEnvelope>().MultiTenanted();
                opts.Schema.For<HomeBoard>().MultiTenanted();
                // Past-tense event projections introduced alongside the
                // server-side switch — same per-account isolation rule as
                // HomeBoard / ProcessedEnvelope.
                opts.Schema.For<CheckInState>().MultiTenanted();
                opts.Schema.For<MonthlyCheckInSummary>().MultiTenanted();
                opts.Schema.For<WeeklyCheckInSummary>().MultiTenanted();
                opts.Schema.For<HabitComplianceHistory>().MultiTenanted();

                opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
                opts.Projections.Add<CheckInIndexProjection>(ProjectionLifecycle.Inline);
                opts.Projections.Add<MonthlyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
                opts.Projections.Add<WeeklyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
                opts.Projections.Add<HabitComplianceHistoryProjection>(ProjectionLifecycle.Inline);
            })
            .UseLightweightSessions();

        // Wire the per-request tenant id (from the `account_id` claim populated by
        // our auth handler) into the `IDocumentSession`/`IQuerySession` that Marten
        // resolves from DI. Without this, `opts.TenantId.IsClaimTypeNamed(...)`
        // on Wolverine HTTP only feeds the message-context and `AssertExists`
        // ProblemDetails path — DI sessions stay non-tenanted and conjoined-tenant
        // reads/writes silently fall through to `*DEFAULT*`, defeating isolation.
        builder.Services.AddMartenTenancyDetection(opts =>
        {
            opts.IsClaimTypeNamed(NagClaimTypes.AccountId);
        });

        return builder;
    }
}
