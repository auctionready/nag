using System.Net;
using System.Net.Http.Json;
using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Nag.Api.Endpoints;
using Nag.Core;
using Nag.Core.Events;
using Nag.Core.Projections;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class AdminEndpointsTests
{
    private readonly PostgresFixture _pg;

    public AdminEndpointsTests(PostgresFixture pg)
    {
        _pg = pg;
    }

    [Fact]
    public async Task refuses_when_admin_secret_not_configured()
    {
        await using var factory = new SecretFactory
        {
            ConnectionString = _pg.ConnectionString,
            SchemaName = "api_admin_no_secret",
            AdminSecret = null,
        };
        var resp = await factory
            .CreateClient()
            .PostAsJsonAsync(
                "/admin/rebuild-projections",
                new RebuildProjectionsRequest("anything")
            );
        resp.StatusCode.ShouldBe(HttpStatusCode.NotImplemented);
    }

    [Fact]
    public async Task refuses_with_wrong_secret()
    {
        await using var factory = new SecretFactory
        {
            ConnectionString = _pg.ConnectionString,
            SchemaName = "api_admin_wrong_secret",
            AdminSecret = "expected-secret",
        };
        var resp = await factory
            .CreateClient()
            .PostAsJsonAsync("/admin/rebuild-projections", new RebuildProjectionsRequest("nope"));
        resp.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task rebuilds_all_projections_with_correct_secret()
    {
        await using var factory = new SecretFactory
        {
            ConnectionString = _pg.ConnectionString,
            SchemaName = "api_admin_rebuild_ok",
            AdminSecret = "expected-secret",
        };
        var resp = await factory
            .CreateClient()
            .PostAsJsonAsync(
                "/admin/rebuild-projections",
                new RebuildProjectionsRequest("expected-secret")
            );
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<RebuildProjectionsResponse>();
        body.ShouldNotBeNull();
        body!.Rebuilt.ShouldBe(
            new[]
            {
                nameof(HomeBoardProjection),
                nameof(CheckInIndexProjection),
                nameof(MonthlyCheckInSummaryProjection),
                nameof(WeeklyCheckInSummaryProjection),
                nameof(HabitComplianceHistoryProjection),
            },
            ignoreOrder: false
        );
    }

    [Fact]
    public async Task rebuild_restores_homeboard_after_projection_doc_is_wiped()
    {
        // End-to-end recovery scenario: an out-of-band actor (raw SQL,
        // a buggy migration) deletes the HomeBoard projection doc while
        // the underlying mt_events stream is intact. After the admin
        // endpoint runs, the HomeBoard is reconstructed from events.
        const string schema = "api_admin_rebuild_restores";
        await using var factory = new SecretFactory
        {
            ConnectionString = _pg.ConnectionString,
            SchemaName = schema,
            AdminSecret = "secret",
        };
        var tenantId = Guid.NewGuid();
        var habitId = Guid.NewGuid();

        var store = factory.Services.GetRequiredService<IDocumentStore>();
        await using (var session = store.LightweightSession(tenantId.ToString()))
        {
            session.Events.Append(NagStreams.Root, new HabitCreated(habitId, "Stretch"));
            await session.SaveChangesAsync();
        }

        // Confirm the inline projection populated HomeBoard at write
        // time (sanity check on the test setup).
        await using (var query = store.QuerySession(tenantId.ToString()))
        {
            var pre = await query.LoadAsync<HomeBoard>(NagStreams.Root);
            pre.ShouldNotBeNull();
            pre!.Habits.ShouldContain(h => h.Id == habitId);
        }

        // Drop the HomeBoard doc out from under Marten — mimicking the
        // raw-SQL recovery scenario where projection state is stale.
        await using (var session = store.LightweightSession(tenantId.ToString()))
        {
            session.Delete<HomeBoard>(NagStreams.Root);
            await session.SaveChangesAsync();
        }

        var resp = await factory
            .CreateClient()
            .PostAsJsonAsync("/admin/rebuild-projections", new RebuildProjectionsRequest("secret"));
        resp.EnsureSuccessStatusCode();

        await using (var query = store.QuerySession(tenantId.ToString()))
        {
            var post = await query.LoadAsync<HomeBoard>(NagStreams.Root);
            post.ShouldNotBeNull();
            post!.Habits.ShouldContain(h => h.Id == habitId && h.Title == "Stretch");
        }
    }

    /// <summary>
    /// Variant of <see cref="NagApiFactory"/> that injects the
    /// <c>Nag:AdminSecret</c> setting via a process env var so the
    /// production config-binding path picks it up at host build time.
    /// The env var is assigned eagerly at property-set time so it lands
    /// before *anything* accesses <see cref="NagApiFactory.Services"/>
    /// or <see cref="HttpClient"/>, both of which trigger host build.
    /// </summary>
    private sealed class SecretFactory : NagApiFactory, IAsyncDisposable
    {
        public string? AdminSecret
        {
            init => Environment.SetEnvironmentVariable("Nag__AdminSecret", value);
        }

        async ValueTask IAsyncDisposable.DisposeAsync() => await DisposeAsync();
    }
}
