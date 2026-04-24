using System.Net;
using System.Net.Http.Headers;
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

    private HttpClient AuthedClient()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            _factory.ApiKey
        );
        return c;
    }

    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    // ----- Happy path per command type -----

    [Fact]
    public async Task CreateHabit_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var envelopeId = Guid.NewGuid().ToString("D"); // 8-4-4-4-12 lower hex
        var habitId = Guid.NewGuid().ToString("D");
        var body = $$"""
            {
              "id": "{{envelopeId}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "type": "CreateHabit",
              "payload": {
                "habitId": "{{habitId}}",
                "title": "Read",
                "description": null,
                "icon": null,
                "goal": null
              }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var accepted = await response.Content.ReadFromJsonAsync<CommandAccepted>();
        accepted!.Accepted.ShouldBeTrue();
    }

    [Fact]
    public async Task CreateHabit_with_inline_goal_is_accepted()
    {
        var client = AuthedClient();
        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:00:00.000Z",
              "type": "CreateHabit",
              "payload": {
                "habitId": "{{Guid.NewGuid():D}}",
                "title": "Meditate",
                "description": null,
                "icon": null,
                "goal": { "regularity": "day", "frequency": 1, "schedules": null }
              }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateHabit_with_clear_flags_is_accepted()
    {
        var client = AuthedClient();
        // First create the habit so UpdateHabit has a target.
        var habitId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "type": "CreateHabit",
                  "payload": { "habitId": "{{habitId}}", "title": "x" }
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:01:00.000Z",
              "type": "UpdateHabit",
              "payload": {
                "habitId": "{{habitId}}",
                "title": "renamed",
                "clearDescription": true,
                "clearGoal": true
              }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteHabit_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "type": "CreateHabit",
                  "payload": { "habitId": "{{habitId}}", "title": "x" }
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:02:00.000Z",
              "type": "DeleteHabit",
              "payload": { "habitId": "{{habitId}}" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CreateCheckIn_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "type": "CreateHabit",
                  "payload": { "habitId": "{{habitId}}", "title": "x" }
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:03:00.000Z",
              "type": "CreateCheckIn",
              "payload": {
                "checkInId": "{{Guid.NewGuid():D}}",
                "habitId": "{{habitId}}",
                "timestamp": "2026-04-24T10:03:00.000Z",
                "skipped": null
              }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateCheckIn_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        var checkInId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "type": "CreateHabit",
                  "payload": { "habitId": "{{habitId}}", "title": "x" }
                }
                """
            )
        );
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:03:00.000Z",
                  "type": "CreateCheckIn",
                  "payload": {
                    "checkInId": "{{checkInId}}",
                    "habitId": "{{habitId}}",
                    "timestamp": "2026-04-24T10:03:00.000Z",
                    "skipped": null
                  }
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:04:00.000Z",
              "type": "UpdateCheckIn",
              "payload": {
                "checkInId": "{{checkInId}}",
                "timestamp": "2026-04-24T10:04:00.000Z",
                "skipped": true
              }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteCheckIn_with_exact_client_wire_shape_is_accepted()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid().ToString("D");
        var checkInId = Guid.NewGuid().ToString("D");
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:00:00.000Z",
                  "type": "CreateHabit",
                  "payload": { "habitId": "{{habitId}}", "title": "x" }
                }
                """
            )
        );
        await client.PostAsync(
            "/commands",
            Json(
                $$"""
                {
                  "id": "{{Guid.NewGuid():D}}",
                  "timestamp": "2026-04-24T10:03:00.000Z",
                  "type": "CreateCheckIn",
                  "payload": {
                    "checkInId": "{{checkInId}}",
                    "habitId": "{{habitId}}",
                    "timestamp": "2026-04-24T10:03:00.000Z",
                    "skipped": null
                  }
                }
                """
            )
        );

        var body = $$"""
            {
              "id": "{{Guid.NewGuid():D}}",
              "timestamp": "2026-04-24T10:05:00.000Z",
              "type": "DeleteCheckIn",
              "payload": { "checkInId": "{{checkInId}}" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
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
              "Type": "CreateHabit",
              "Payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
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
              "type": "CreateHabit",
              "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
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
              "type": "CreateHabit",
              "payload": { "habitId": "not-a-uuid", "title": "x" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
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
              "type": "CreateHabit",
              "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
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
              "type": "CreateHabit",
              "payload": { "habitId": "{{Guid.NewGuid():D}}", "title": "x" }
            }
            """;

        var response = await client.PostAsync("/commands", Json(body));
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
