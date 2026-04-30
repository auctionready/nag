using System.Net;
using System.Net.Http.Json;
using System.Text;
using Nag.Core.Contracts;
using Nag.Tests.Infrastructure;
using Shouldly;

namespace Nag.Tests.Api;

/// <summary>
/// End-to-end tests that send the <strong>exact wire format</strong> the
/// JavaScript client produces (camelCase property names, ISO-8601 UTC
/// timestamps with <c>Z</c> suffix, D-format UUID strings). Uses raw
/// <see cref="StringContent"/> bodies rather than <c>PostAsJsonAsync</c>
/// so that C#-side serializer quirks don't mask real JS↔.NET mismatches.
///
/// These tests are the regression net for issues like
/// <c>"The JSON value is not in a supported Guid format. Path: $.id"</c>:
/// when that happens in production, the corresponding test here is the
/// first place to check for drift between the OpenAPI contract and the
/// server's expected shape.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ClientWireShapeTests : IClassFixture<ClientWireShapeTests.Factory>
{
    private readonly Factory _factory;

    public ClientWireShapeTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_wire_shape";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient() => _factory.CreateAuthedClient();

    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    // ----- Happy path per event type -----

    [Fact]
    public async Task HabitCreated_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var envelopeId = Guid.NewGuid().ToString("D"); // 8-4-4-4-12 lower hex
        var habitId = Guid.NewGuid().ToString("D");
        var body = $$"""
            {
              "id": "{{envelopeId}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": {
                    "habitId": "{{habitId}}",
                    "title": "Read",
                    "description": null,
                    "icon": null,
                    "goal": null
                  }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Headers.Location!.ToString().ShouldBe($"/events/by-envelope/{envelopeId}");
        response.Headers.TryGetValues("X-Nag-Sequence", out var seq).ShouldBeTrue();
        long.Parse(seq!.Single()).ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task HabitCreated_with_inline_goal_is_accepted()
    {
        var client = AuthedClient();
        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": {
                    "habitId": "{{Guid.NewGuid():D}}",
                    "title": "Meditate",
                    "description": null,
                    "icon": null,
                    "goal": { "regularity": "day", "frequency": 1, "schedules": null }
                  }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task HabitDetailsEdited_and_HabitGoalCleared_in_one_envelope_are_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "events": [
                    {
                      "type": "HabitCreated",
                      "payload": { "habitId": "{{habitId}}", "title": "x" }
                    }
                  ]
                }
                """
            )
        );

        // The TS UpdateHabit handler emits one envelope carrying both the
        // edit and the goal-cleared events; this exercises that shape.
        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:01:00.000Z",
              "events": [
                {
                  "type": "HabitDetailsEdited",
                  "payload": {
                    "habitId": "{{habitId}}",
                    "title": "renamed",
                    "clearDescription": true
                  }
                },
                {
                  "type": "HabitGoalCleared",
                  "payload": { "habitId": "{{habitId}}" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task HabitDeleted_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "events": [
                    {
                      "type": "HabitCreated",
                      "payload": { "habitId": "{{habitId}}", "title": "x" }
                    }
                  ]
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:02:00.000Z",
              "events": [
                {
                  "type": "HabitDeleted",
                  "payload": { "habitId": "{{habitId}}" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CheckInRecorded_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        var checkInTs = DateTimeOffset.UtcNow.ToString("O");
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "events": [
                    {
                      "type": "HabitCreated",
                      "payload": { "habitId": "{{habitId}}", "title": "x" }
                    }
                  ]
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:03:00.000Z",
              "events": [
                {
                  "type": "CheckInRecorded",
                  "payload": {
                    "checkInId": "{{Guid.NewGuid():D}}",
                    "habitId": "{{habitId}}",
                    "timestamp": "{{checkInTs}}",
                    "skipped": false
                  }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CheckInMoved_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        var checkInId = Guid.NewGuid().ToString("D");
        var oldTs = DateTimeOffset.UtcNow.ToString("O");
        var newTs = DateTimeOffset.UtcNow.AddMinutes(1).ToString("O");
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "events": [
                    {
                      "type": "HabitCreated",
                      "payload": { "habitId": "{{habitId}}", "title": "x" }
                    }
                  ]
                }
                """
            )
        );
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:03:00.000Z",
                  "events": [
                    {
                      "type": "CheckInRecorded",
                      "payload": {
                        "checkInId": "{{checkInId}}",
                        "habitId": "{{habitId}}",
                        "timestamp": "{{oldTs}}"
                      }
                    }
                  ]
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:04:00.000Z",
              "events": [
                {
                  "type": "CheckInMoved",
                  "payload": {
                    "checkInId": "{{checkInId}}",
                    "habitId": "{{habitId}}",
                    "oldTimestamp": "{{oldTs}}",
                    "newTimestamp": "{{newTs}}"
                  }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CheckInDeleted_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        var checkInId = Guid.NewGuid().ToString("D");
        var checkInTs = DateTimeOffset.UtcNow.ToString("O");
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "events": [
                    {
                      "type": "HabitCreated",
                      "payload": { "habitId": "{{habitId}}", "title": "x" }
                    }
                  ]
                }
                """
            )
        );
        await client.PostAsync(
            "/events",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:03:00.000Z",
                  "events": [
                    {
                      "type": "CheckInRecorded",
                      "payload": {
                        "checkInId": "{{checkInId}}",
                        "habitId": "{{habitId}}",
                        "timestamp": "{{checkInTs}}"
                      }
                    }
                  ]
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:05:00.000Z",
              "events": [
                {
                  "type": "CheckInDeleted",
                  "payload": {
                    "checkInId": "{{checkInId}}",
                    "habitId": "{{habitId}}",
                    "timestamp": "{{checkInTs}}"
                  }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    // ----- Case sensitivity -----

    [Fact]
    public async Task PascalCase_envelope_fields_are_also_accepted_under_Web_defaults()
    {
        // JsonSerializerDefaults.Web is case-insensitive, so this should work.
        // If that ever changes this test will fail and we'll know to pick a side.
        var client = AuthedClient();
        var body = $$"""
            {
              "Id": "{{Guid.NewGuid():D}}",
              "Timestamp": "2026-04-24T10:00:00.000Z",
              "Events": [
                {
                  "Type": "HabitCreated",
                  "Payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    // ----- Non-retriable failure modes, with a helpful error body -----

    [Fact]
    public async Task Non_uuid_envelope_id_is_rejected_with_400()
    {
        var client = AuthedClient();
        var body = $$"""
            {
              "id": "not-a-uuid",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Non_uuid_habit_id_in_payload_is_rejected_with_400()
    {
        var client = AuthedClient();
        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": { "habitId": "not-a-uuid", "title": "x" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Braced_guid_format_is_rejected()
    {
        // System.Text.Json's GetGuid accepts only the D (hyphen-separated,
        // no braces) format. The client generates D-format UUIDs; this
        // test pins that contract so a migration to B-format on either
        // side would be caught immediately.
        var client = AuthedClient();
        var id = "{" + Guid.NewGuid().ToString("D") + "}";
        var body = $$"""
            {
              "id": "{{id}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Non_hyphenated_guid_format_is_rejected()
    {
        // Format "N" (32 hex chars, no dashes) is also rejected by default.
        var client = AuthedClient();
        var id = Guid.NewGuid().ToString("N");
        var body = $$"""
            {
              "id": "{{id}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "events": [
                {
                  "type": "HabitCreated",
                  "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
                }
              ]
            }
            """;

        var response = await client.PostAsync("/events", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
