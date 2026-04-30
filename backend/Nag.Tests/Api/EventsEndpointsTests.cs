using System.Net;
using System.Net.Http.Json;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class EventsEndpointsTests : IClassFixture<EventsEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public EventsEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_events";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient() => _factory.CreateAuthedClient();

    public class Posting_a_habit_created_event : EventsEndpointsTests
    {
        public Posting_a_habit_created_event(PostgresFixture pg, Factory factory)
            : base(pg, factory) { }

        [Fact]
        public async Task accepts_first_post()
        {
            var client = AuthedClient();
            var envelope = new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new { habitId = Guid.NewGuid(), title = "Read" },
                    },
                },
            };

            var response = await client.PostAsJsonAsync("/events", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var result = await response.Content.ReadFromJsonAsync<WriteEventAccepted>();
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
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new { habitId = Guid.NewGuid(), title = "Read" },
                    },
                },
            };

            var first = await client.PostAsJsonAsync("/events", envelope);
            var firstResult = await first.Content.ReadFromJsonAsync<WriteEventAccepted>();

            var second = await client.PostAsJsonAsync("/events", envelope);
            second.StatusCode.ShouldBe(HttpStatusCode.OK);
            var secondResult = await second.Content.ReadFromJsonAsync<WriteEventAccepted>();
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
                timestamp = DateTimeOffset.UtcNow,
                events = new[] { new { type = "NotARealEvent", payload = new { } } },
            };

            var response = await client.PostAsJsonAsync("/events", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task empty_title_returns_400()
        {
            var client = AuthedClient();
            var envelope = new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new { habitId = Guid.NewGuid(), title = "" },
                    },
                },
            };

            var response = await client.PostAsJsonAsync("/events", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task multi_event_envelope_appends_all_atomically()
        {
            var client = AuthedClient();
            var habitId = Guid.NewGuid();
            var envelope = new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new object[]
                {
                    new { type = "HabitCreated", payload = new { habitId, title = "Read" } },
                    new
                    {
                        type = "HabitDetailsEdited",
                        payload = new { habitId, title = "Read more" },
                    },
                },
            };

            var response = await client.PostAsJsonAsync("/events", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var result = await response.Content.ReadFromJsonAsync<WriteEventAccepted>();
            result!.Sequence.ShouldBeGreaterThanOrEqualTo(2);
        }
    }

    public class Reading_events_since_a_pointer : EventsEndpointsTests
    {
        public Reading_events_since_a_pointer(PostgresFixture pg, Factory factory)
            : base(pg, factory) { }

        [Fact]
        public async Task returns_appended_events_in_order()
        {
            var client = AuthedClient();
            await PostHabitCreated(client, "Read");
            await PostHabitCreated(client, "Run");

            var page = await client.GetFromJsonAsync<EventsPage>("/events?since=0");
            page.ShouldNotBeNull();
            page!.Events.Count.ShouldBeGreaterThanOrEqualTo(2);
            page.Events.Select(c => c.Sequence).ShouldBeInOrder();
        }

        [Fact]
        public async Task pagination_via_limit_returns_nextSince()
        {
            var client = AuthedClient();
            await PostHabitCreated(client, "Read");
            await PostHabitCreated(client, "Run");
            await PostHabitCreated(client, "Stretch");

            var page = await client.GetFromJsonAsync<EventsPage>("/events?since=0&limit=2");
            page!.Events.Count.ShouldBe(2);
            page.NextSince.ShouldNotBeNull();
        }
    }

    private static async Task PostHabitCreated(HttpClient client, string title)
    {
        var envelope = new
        {
            id = Guid.NewGuid(),
            timestamp = DateTimeOffset.UtcNow,
            events = new[]
            {
                new { type = "HabitCreated", payload = new { habitId = Guid.NewGuid(), title } },
            },
        };
        var resp = await client.PostAsJsonAsync("/events", envelope);
        resp.EnsureSuccessStatusCode();
    }
}
