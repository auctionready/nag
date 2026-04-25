using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Nag.Core.Contracts;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class SyncEndpointsTests : IClassFixture<SyncEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public SyncEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_sync";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            _factory.ApiKey
        );
        return c;
    }

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

    [Fact]
    public async Task since_zero_returns_snapshot()
    {
        var client = AuthedClient();
        await PostHabit(client, "Read");
        await PostHabit(client, "Run");

        var raw = await client.GetStringAsync("/sync?since=0");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
        doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBeGreaterThan(0);
        var snapshot = doc.RootElement.GetProperty("snapshot");
        snapshot.GetProperty("habits").GetArrayLength().ShouldBe(2);
    }

    [Fact]
    public async Task small_gap_returns_replay()
    {
        var client = AuthedClient();
        var first = await PostHabit(client, "Read");
        await PostHabit(client, "Run");

        var raw = await client.GetStringAsync($"/sync?since={first}");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("mode").GetString().ShouldBe("replay");
        var commands = doc.RootElement.GetProperty("commands");
        commands.GetArrayLength().ShouldBe(1);
        commands[0].GetProperty("type").GetString().ShouldBe("CreateHabit");
        commands[0].GetProperty("sequence").GetInt64().ShouldBeGreaterThan(first);
        doc.RootElement.GetProperty("headSequence").GetInt64().ShouldBeGreaterThan(first);
    }

    [Fact]
    public async Task large_gap_falls_back_to_snapshot()
    {
        var client = AuthedClient();
        // SnapshotThreshold = 50; post 60 commands then ask for since=1.
        for (int i = 0; i < 60; i++)
        {
            await PostHabit(client, $"H{i}");
        }

        var raw = await client.GetStringAsync("/sync?since=1");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
    }

    [Fact]
    public async Task snapshot_carries_last_sequence()
    {
        var client = AuthedClient();
        await PostHabit(client, "Read");
        var lastSeq = await PostHabit(client, "Run");

        var raw = await client.GetStringAsync("/sync?since=0");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBe(lastSeq);
    }

    [Fact]
    public async Task at_head_returns_empty_replay()
    {
        var client = AuthedClient();
        var lastSeq = await PostHabit(client, "Read");

        var raw = await client.GetStringAsync($"/sync?since={lastSeq}");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("mode").GetString().ShouldBe("replay");
        doc.RootElement.GetProperty("commands").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task empty_store_returns_snapshot_with_zero_sequence()
    {
        var client = AuthedClient();
        var raw = await client.GetStringAsync("/sync?since=0");
        using var doc = JsonDocument.Parse(raw);
        doc.RootElement.GetProperty("mode").GetString().ShouldBe("snapshot");
        doc.RootElement.GetProperty("sequenceAtSnapshot").GetInt64().ShouldBe(0);
        doc.RootElement.GetProperty("snapshot").GetProperty("habits").GetArrayLength().ShouldBe(0);
    }
}
