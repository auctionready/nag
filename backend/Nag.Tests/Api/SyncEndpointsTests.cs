using System.Net.Http.Json;
using System.Text.Json;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class SyncEndpointsTests
{
    protected readonly PostgresFixture Pg;

    public SyncEndpointsTests(PostgresFixture pg)
    {
        Pg = pg;
    }

    private static HttpClient AuthedClient(NagApiFactory factory) => factory.CreateAuthedClient();

    private static async Task<long> PostHabit(HttpClient client, string title)
    {
        var envelope = new
        {
            id = Guid.NewGuid(),
            type = "CreateHabit",
            timestamp = DateTimeOffset.UtcNow,
            payload = new { habitId = Guid.NewGuid(), title },
        };
        var resp = await client.PostAsJsonAsync("/commands", envelope);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<CommandAccepted>();
        return body!.Sequence;
    }

    public class SinceZeroReturnsSnapshot
        : SyncEndpointsTests,
            IClassFixture<SinceZeroReturnsSnapshot.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public SinceZeroReturnsSnapshot(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_since0";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            await PostHabit(client, "Read");
            await PostHabit(client, "Run");

            var raw = await client.GetStringAsync("/sync?since=0");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
            doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBeGreaterThan(0);
            var snapshot = doc.RootElement.GetProperty("snapshot");
            snapshot.GetProperty("habits").GetArrayLength().ShouldBe(2);
        }
    }

    public class SmallGapReturnsReplay
        : SyncEndpointsTests,
            IClassFixture<SmallGapReturnsReplay.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public SmallGapReturnsReplay(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_smallgap";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            var first = await PostHabit(client, "Read");
            await PostHabit(client, "Run");

            var raw = await client.GetStringAsync($"/sync?since={first}");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("mode").GetString().ShouldBe("replay");
            var events = doc.RootElement.GetProperty("events");
            events.GetArrayLength().ShouldBe(1);
            events[0].GetProperty("type").GetString().ShouldBe("HabitCreated");
            events[0].GetProperty("sequence").GetInt64().ShouldBeGreaterThan(first);
            doc.RootElement.GetProperty("headSequence").GetInt64().ShouldBeGreaterThan(first);
        }
    }

    public class LargeGapFallsBackToSnapshot
        : SyncEndpointsTests,
            IClassFixture<LargeGapFallsBackToSnapshot.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public LargeGapFallsBackToSnapshot(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_largegap";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            // SnapshotThreshold = 50; post 60 commands then ask for since=1.
            for (int i = 0; i < 60; i++)
            {
                await PostHabit(client, $"H{i}");
            }

            var raw = await client.GetStringAsync("/sync?since=1");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
        }
    }

    public class SnapshotCarriesLastSequence
        : SyncEndpointsTests,
            IClassFixture<SnapshotCarriesLastSequence.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public SnapshotCarriesLastSequence(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_lastseq";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            await PostHabit(client, "Read");
            var lastSeq = await PostHabit(client, "Run");

            var raw = await client.GetStringAsync("/sync?since=0");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBe(lastSeq);
        }
    }

    public class AtHeadReturnsEmptyReplay
        : SyncEndpointsTests,
            IClassFixture<AtHeadReturnsEmptyReplay.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public AtHeadReturnsEmptyReplay(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_athead";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            var lastSeq = await PostHabit(client, "Read");

            var raw = await client.GetStringAsync($"/sync?since={lastSeq}");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("mode").GetString().ShouldBe("replay");
            doc.RootElement.GetProperty("events").GetArrayLength().ShouldBe(0);
        }
    }

    public class EmptyStoreReturnsSnapshotWithZeroSequence
        : SyncEndpointsTests,
            IClassFixture<EmptyStoreReturnsSnapshotWithZeroSequence.Factory>
    {
        public sealed class Factory : NagApiFactory;

        public EmptyStoreReturnsSnapshotWithZeroSequence(PostgresFixture pg, Factory factory)
            : base(pg)
        {
            factory.ConnectionString = pg.ConnectionString;
            factory.SchemaName = "api_sync_empty";
            _factory = factory;
        }

        private readonly Factory _factory;

        [Fact]
        public async Task ok()
        {
            var client = AuthedClient(_factory);
            var raw = await client.GetStringAsync("/sync?since=0");
            using var doc = JsonDocument.Parse(raw);
            doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
            doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBe(0);
            doc.RootElement.GetProperty("snapshot")
                .GetProperty("habits")
                .GetArrayLength()
                .ShouldBe(0);
        }
    }
}
