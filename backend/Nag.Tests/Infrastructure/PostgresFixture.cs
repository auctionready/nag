using JasperFx.Events.Projections;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Nag.Core.Contracts;
using Nag.Core.Projections;
using Testcontainers.PostgreSql;
using Xunit;

namespace Nag.Tests.Infrastructure;

public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        // Local-Postgres escape hatch for environments without Docker
        // (CI sandboxes, devcontainers without DinD). When set, skip
        // Testcontainers and target the supplied connection directly;
        // each test class still picks its own schema, so the database
        // is shared but isolated.
        var local = Environment.GetEnvironmentVariable("NAG_TEST_PG_CONNECTION");
        if (!string.IsNullOrWhiteSpace(local))
        {
            ConnectionString = local;
            return;
        }
        _container = new PostgreSqlBuilder("postgres:17").Build();
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public DocumentStore CreateStore(string schemaName)
    {
        return DocumentStore.For(opts =>
        {
            opts.Connection(ConnectionString);
            opts.DatabaseSchemaName = schemaName;
            opts.Events.DatabaseSchemaName = schemaName;
            opts.Events.StreamIdentity = JasperFx.Events.StreamIdentity.AsGuid;

            foreach (var t in CommandRegistry.All)
                opts.Events.AddEventType(t);
            foreach (var t in EventRegistry.All)
                opts.Events.AddEventType(t);

            opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<CheckInIndexProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<MonthlyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<WeeklyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
        });
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}
