using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class CommandsEndpointsTests : IClassFixture<CommandsEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public CommandsEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_commands";
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

    public class Posting_a_create_habit_command : CommandsEndpointsTests
    {
        public Posting_a_create_habit_command(PostgresFixture pg, Factory factory)
            : base(pg, factory) { }

        [Fact]
        public async Task accepts_first_post()
        {
            var client = AuthedClient();
            var envelope = new
            {
                id = Guid.NewGuid(),
                type = "CreateHabit",
                timestamp = DateTimeOffset.UtcNow,
                payload = new { habitId = Guid.NewGuid(), title = "Read" },
            };

            var response = await client.PostAsJsonAsync("/commands", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var result = await response.Content.ReadFromJsonAsync<CommandAccepted>();
            result.ShouldNotBeNull();
            result!.Accepted.ShouldBeTrue();
            result.Sequence.ShouldBeGreaterThan(0);
        }

        [Fact]
        public async Task duplicate_post_returns_existing_sequence()
        {
            var client = AuthedClient();
            var id = Guid.NewGuid();
            var envelope = new
            {
                id,
                type = "CreateHabit",
                timestamp = DateTimeOffset.UtcNow,
                payload = new { habitId = Guid.NewGuid(), title = "Read" },
            };

            var first = await client.PostAsJsonAsync("/commands", envelope);
            var firstResult = await first.Content.ReadFromJsonAsync<CommandAccepted>();

            var second = await client.PostAsJsonAsync("/commands", envelope);
            second.StatusCode.ShouldBe(HttpStatusCode.OK);
            var secondResult = await second.Content.ReadFromJsonAsync<CommandAccepted>();
            secondResult!.Accepted.ShouldBeFalse();
            secondResult.Sequence.ShouldBe(firstResult!.Sequence);
        }

        [Fact]
        public async Task unknown_type_returns_400()
        {
            var client = AuthedClient();
            var envelope = new
            {
                id = Guid.NewGuid(),
                type = "NotARealCommand",
                timestamp = DateTimeOffset.UtcNow,
                payload = new { },
            };

            var response = await client.PostAsJsonAsync("/commands", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task empty_title_returns_400()
        {
            var client = AuthedClient();
            var envelope = new
            {
                id = Guid.NewGuid(),
                type = "CreateHabit",
                timestamp = DateTimeOffset.UtcNow,
                payload = new { habitId = Guid.NewGuid(), title = "" },
            };

            var response = await client.PostAsJsonAsync("/commands", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }
    }

    public class Reading_commands_since_a_pointer : CommandsEndpointsTests
    {
        public Reading_commands_since_a_pointer(PostgresFixture pg, Factory factory)
            : base(pg, factory) { }

        [Fact]
        public async Task returns_appended_commands_in_order()
        {
            var client = AuthedClient();
            await PostHabit(client, "Read");
            await PostHabit(client, "Run");

            var page = await client.GetFromJsonAsync<CommandsPage>("/commands?since=0");
            page.ShouldNotBeNull();
            page!.Commands.Count.ShouldBeGreaterThanOrEqualTo(2);
            page.Commands.Select(c => c.Sequence).ShouldBeInOrder();
        }

        [Fact]
        public async Task pagination_via_limit_returns_nextSince()
        {
            var client = AuthedClient();
            await PostHabit(client, "Read");
            await PostHabit(client, "Run");
            await PostHabit(client, "Stretch");

            var page = await client.GetFromJsonAsync<CommandsPage>("/commands?since=0&limit=2");
            page!.Commands.Count.ShouldBe(2);
            page.NextSince.ShouldNotBeNull();
        }
    }

    private static async Task PostHabit(HttpClient client, string title)
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
    }
}
