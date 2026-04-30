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
        public async Task accepts_first_post_as_201_with_location_and_event_body()
        {
            var client = AuthedClient();
            var envelopeId = Guid.NewGuid();
            var habitId = Guid.NewGuid();
            var envelope = new
            {
                id = envelopeId,
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new { type = "HabitCreated", payload = new { habitId, title = "Read" } },
                },
            };

            var response = await client.PostAsJsonAsync("/events", envelope);
            response.StatusCode.ShouldBe(HttpStatusCode.Created);
            response.Headers.Location!.ToString().ShouldBe($"/events/by-envelope/{envelopeId}");

            // 201 carries the just-appended events (RFC 7231 §6.3.2: a 201
            // may include a representation of the new resource).
            var body = await response.Content.ReadFromJsonAsync<EventsByEnvelope>(
                NagJsonOptions.Default
            );
            body.ShouldNotBeNull();
            body!.Id.ShouldBe(envelopeId);
            body.Events.Count.ShouldBe(1);
            body.Events[0].Type.ShouldBe("HabitCreated");
            body.Events[0].Sequence.ShouldBeGreaterThan(0);
        }

        [Fact]
        public async Task duplicate_post_returns_200_with_same_event_body()
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
            first.StatusCode.ShouldBe(HttpStatusCode.Created);
            var firstBody = await first.Content.ReadFromJsonAsync<EventsByEnvelope>(
                NagJsonOptions.Default
            );

            var second = await client.PostAsJsonAsync("/events", envelope);
            second.StatusCode.ShouldBe(HttpStatusCode.OK);
            second.Headers.Location!.ToString().ShouldBe($"/events/by-envelope/{id}");

            var secondBody = await second.Content.ReadFromJsonAsync<EventsByEnvelope>(
                NagJsonOptions.Default
            );
            secondBody.ShouldNotBeNull();
            secondBody!.Id.ShouldBe(id);
            secondBody
                .Events.Select(e => e.Sequence)
                .ShouldBe(firstBody!.Events.Select(e => e.Sequence));
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
        public async Task multi_event_envelope_returns_all_appended_events_in_order()
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
            response.StatusCode.ShouldBe(HttpStatusCode.Created);
            var body = await response.Content.ReadFromJsonAsync<EventsByEnvelope>(
                NagJsonOptions.Default
            );
            body!.Events.Select(e => e.Type).ShouldBe(["HabitCreated", "HabitDetailsEdited"]);
            body.Events.Select(e => e.Sequence).ShouldBeInOrder();
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

    public class Fetching_events_by_envelope_id : EventsEndpointsTests
    {
        public Fetching_events_by_envelope_id(PostgresFixture pg, Factory factory)
            : base(pg, factory) { }

        [Fact]
        public async Task returns_only_the_events_appended_for_that_envelope()
        {
            var client = AuthedClient();

            // Append two unrelated envelopes around the one we'll query for,
            // so we can prove the endpoint filters to the right range.
            await PostHabitCreated(client, "Before");

            var habitId = Guid.NewGuid();
            var targetId = Guid.NewGuid();
            var resp = await client.PostAsJsonAsync(
                "/events",
                new
                {
                    id = targetId,
                    timestamp = DateTimeOffset.UtcNow,
                    events = new object[]
                    {
                        new { type = "HabitCreated", payload = new { habitId, title = "Target" } },
                        new
                        {
                            type = "HabitDetailsEdited",
                            payload = new { habitId, title = "Target renamed" },
                        },
                    },
                }
            );
            resp.StatusCode.ShouldBe(HttpStatusCode.Created);

            await PostHabitCreated(client, "After");

            var page = await client.GetFromJsonAsync<EventsByEnvelope>(
                $"/events/by-envelope/{targetId}",
                NagJsonOptions.Default
            );
            page.ShouldNotBeNull();
            page!.Id.ShouldBe(targetId);
            page.Events.Count.ShouldBe(2);
            page.Events.Select(e => e.Type).ShouldBe(["HabitCreated", "HabitDetailsEdited"]);
            page.Events.Select(e => e.Sequence).ShouldBeInOrder();
        }

        [Fact]
        public async Task unknown_envelope_id_returns_404()
        {
            var client = AuthedClient();
            var resp = await client.GetAsync($"/events/by-envelope/{Guid.NewGuid()}");
            resp.StatusCode.ShouldBe(HttpStatusCode.NotFound);
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
