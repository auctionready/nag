using System.Text.Json;
using Marten;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Nag.Core.Idempotency;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class EventsEndpoints
{
    /// <summary>
    /// Append the events the client emitted for a single user intent.
    /// Idempotent on <see cref="WriteEventEnvelope.Id"/>; the events are
    /// appended atomically — partial failures roll back. Empty
    /// <c>events</c> arrays reserve the envelope id and behave like an
    /// accepted-but-empty append.
    ///
    /// Response shape (REST-pure: no body, status code carries
    /// accepted-vs-duplicate):
    /// <list type="bullet">
    ///   <item><description><c>201 Created</c> — first time this envelope id was seen.</description></item>
    ///   <item><description><c>200 OK</c> — duplicate replay; the original sequence range is unchanged.</description></item>
    ///   <item><description><c>400 Bad Request</c> — validation failure or unknown event type, with <see cref="ErrorResponse"/> body.</description></item>
    /// </list>
    ///
    /// Both 201 and 200 carry:
    /// <list type="bullet">
    ///   <item><description><c>Location: /events/by-envelope/{id}</c> — fetch the appended events via <see cref="GetEventsByEnvelope"/>.</description></item>
    ///   <item><description><c>X-Nag-Sequence: &lt;n&gt;</c> — the highest sequence number assigned to events in this envelope (or <c>0</c> for empty envelopes), so the dispatcher can advance its high-water mark without a follow-up GET on the happy path.</description></item>
    /// </list>
    /// </summary>
    [Tags("Events")]
    [EndpointName("postEvents")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/events")]
    public static async Task<IResult> PostEvents(
        WriteEventEnvelope envelope,
        EventDispatcher dispatcher,
        HttpResponse response,
        CancellationToken ct
    )
    {
        if (envelope.Id == Guid.Empty)
            return Results.BadRequest(new ErrorResponse(["envelope.id is required"]));

        var events = new List<object>(envelope.Events.Count);
        foreach (var entry in envelope.Events)
        {
            object? @event;
            try
            {
                if (
                    !EventRegistry.TryDeserialize(
                        entry.Type,
                        entry.Payload,
                        NagJsonOptions.Default,
                        out @event
                    )
                )
                {
                    return Results.BadRequest(
                        new ErrorResponse([$"Unknown event type: {entry.Type}"])
                    );
                }
            }
            catch (JsonException ex)
            {
                // Payload JSON is well-formed at the envelope level (otherwise
                // the request wouldn't have gotten here) but fails to bind to
                // the event record — e.g. payload.habitId is not a Guid.
                // Translate to a 400 so the client halts this envelope rather
                // than treating it as a transient 5xx and retrying forever.
                return Results.BadRequest(
                    new ErrorResponse([$"Invalid payload for {entry.Type}: {ex.Message}"])
                );
            }
            events.Add(@event!);
        }

        var result = await dispatcher.DispatchAsync(envelope.Id, events, ct);
        return result.Outcome switch
        {
            DispatchOutcome.Accepted => WriteHeadersAndStatus(
                response,
                envelope.Id,
                result.LastSequence,
                StatusCodes.Status201Created
            ),
            DispatchOutcome.Duplicate => WriteHeadersAndStatus(
                response,
                envelope.Id,
                result.LastSequence,
                StatusCodes.Status200OK
            ),
            DispatchOutcome.Invalid => Results.BadRequest(new ErrorResponse(result.Errors)),
            _ => Results.StatusCode(500),
        };
    }

    private static IResult WriteHeadersAndStatus(
        HttpResponse response,
        Guid envelopeId,
        long lastSequence,
        int statusCode
    )
    {
        response.Headers.Location = $"/events/by-envelope/{envelopeId}";
        response.Headers["X-Nag-Sequence"] = lastSequence.ToString();
        return Results.StatusCode(statusCode);
    }

    /// <summary>
    /// Pages of past-tense events (<see cref="EventEnvelope"/>) since
    /// <c>since</c>, capped at <c>limit</c> (default + max 500). The
    /// client uses this to backfill local state from the server's
    /// authoritative event log.
    /// </summary>
    [Tags("Events")]
    [EndpointName("getEvents")]
    [ProducesResponseType(typeof(EventsPage), StatusCodes.Status200OK)]
    [WolverineGet("/events")]
    public static async Task<IResult> GetEvents(
        [FromQuery] long since,
        [FromQuery] int? limit,
        EventsReader reader,
        CancellationToken ct
    )
    {
        var page = await reader.ReadSinceAsync(since, limit, ct);
        return Results.Ok(page);
    }

    /// <summary>
    /// Returns the events the server appended for one previously-POSTed
    /// envelope. Idempotent and cacheable: once <c>POST /events</c> has
    /// dispatched envelope <c>X</c>, this endpoint returns the same
    /// payload forever. Empty envelopes (no-op intents the dispatcher
    /// reserved) return <c>events: []</c>; unknown envelope ids 404.
    /// </summary>
    [Tags("Events")]
    [EndpointName("getEventsByEnvelope")]
    [ProducesResponseType(typeof(EventsByEnvelope), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [WolverineGet("/events/by-envelope/{id:guid}")]
    public static async Task<IResult> GetEventsByEnvelope(
        Guid id,
        IQuerySession session,
        JsonSerializerOptions jsonOptions,
        CancellationToken ct
    )
    {
        var record = await session.LoadAsync<ProcessedEnvelope>(id, ct);
        if (record is null)
            return Results.NotFound();

        if (record.LastSequence == 0)
        {
            // Empty envelope — id was reserved but no events were appended.
            return Results.Ok(new EventsByEnvelope(id, []));
        }

        var rawEvents = await session
            .Events.QueryAllRawEvents()
            .Where(e => e.Sequence >= record.FirstSequence && e.Sequence <= record.LastSequence)
            .OrderBy(e => e.Sequence)
            .ToListAsync(ct);

        var envelopes = rawEvents
            .Select(e => new EventEnvelope(
                e.Sequence,
                e.Id,
                EventRegistry.ByName.FirstOrDefault(kv => kv.Value == e.Data!.GetType()).Key
                    ?? e.EventTypeName,
                new DateTimeOffset(e.Timestamp.UtcDateTime, TimeSpan.Zero),
                JsonSerializer.SerializeToElement(e.Data, jsonOptions)
            ))
            .ToList();

        return Results.Ok(new EventsByEnvelope(id, envelopes));
    }
}
