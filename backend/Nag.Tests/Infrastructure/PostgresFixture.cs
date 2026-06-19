using JasperFx.Events.Projections;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Nag.Core.Contracts;
using Nag.Core.Projections;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Nag.Tests.Infrastructure;

public sealed class PostgresFixture : IAsyncLifetime
{
    /// <summary>
    /// The whole suite runs against this one auto-created database, whatever
    /// database the caller named in <c>NAG_TEST_PG_CONNECTION</c> (or the
    /// Testcontainers default). Callers only have to point us at a reachable
    /// Postgres *instance* — we never write into the database they named, so a
    /// connection string aimed at a real/shared database can't be polluted.
    /// Test classes still isolate from each other by schema within it.
    /// </summary>
    public const string TestDatabase = "nag_auto_test";

    private PostgreSqlContainer? _container;

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        // Local-Postgres escape hatch for environments without Docker
        // (CI sandboxes, devcontainers without DinD). When set, skip
        // Testcontainers and target the supplied instance directly.
        string baseConnection;
        var local = Environment.GetEnvironmentVariable("NAG_TEST_PG_CONNECTION");
        if (!string.IsNullOrWhiteSpace(local))
        {
            baseConnection = local;
        }
        else
        {
            _container = new PostgreSqlBuilder("postgres:17").Build();
            await _container.StartAsync();
            baseConnection = _container.GetConnectionString();
        }

        ConnectionString = await EnsureTestDatabase(baseConnection);
    }

    /// <summary>
    /// Rewrites <paramref name="baseConnection"/> to target
    /// <see cref="TestDatabase"/>, creating that database on the instance if it
    /// doesn't exist yet. <c>CREATE DATABASE</c> can't run against the target
    /// itself, so we connect to the <c>postgres</c> maintenance database on the
    /// same instance to issue it.
    /// </summary>
    private static async Task<string> EnsureTestDatabase(string baseConnection)
    {
        var target = new NpgsqlConnectionStringBuilder(baseConnection) { Database = TestDatabase };
        var admin = new NpgsqlConnectionStringBuilder(baseConnection) { Database = "postgres" };

        await using var conn = new NpgsqlConnection(admin.ConnectionString);
        await conn.OpenAsync();

        await using var exists = new NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = @name",
            conn
        );
        exists.Parameters.AddWithValue("name", TestDatabase);
        if (await exists.ExecuteScalarAsync() is null)
        {
            try
            {
                await using var create = new NpgsqlCommand(
                    $"CREATE DATABASE \"{TestDatabase}\"",
                    conn
                );
                await create.ExecuteNonQueryAsync();
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.DuplicateDatabase)
            {
                // Created concurrently between the check and here — fine.
            }
        }

        return target.ConnectionString;
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

            foreach (var t in EventRegistry.All)
                opts.Events.AddEventType(t);

            opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<CheckInIndexProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<MonthlyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<WeeklyCheckInSummaryProjection>(ProjectionLifecycle.Inline);
            opts.Projections.Add<HabitComplianceHistoryProjection>(ProjectionLifecycle.Inline);
        });
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}
