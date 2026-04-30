using System.Text.Json;
using Marten;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Nag.Core.Idempotency;
using Wolverine.Http;
using JasperFxIEvent = JasperFx.Events.IEvent;

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
    /// Response shape (REST 201/200 with the new resource's
    /// representation, per RFC 7231 §6.3.2):
    /// <list type="bullet">
    ///   <item><description><c>201 Created</c> — first time this envelope id was seen.</description></item>
    ///   <item><description><c>200 OK</c> — duplicate replay; the original sequence range is unchanged.</description></item>
    ///   <item><description><c>400 Bad Request</c> — validation failure or unknown event type, with <see cref="ErrorResponse"/> body.</description></item>
    /// </list>
    ///
    /// Both 201 and 200 carry:
    /// <list type="bullet">
    ///   <item><description><c>Location: /events/by-envelope/{id}</c> — the canonical URL for this envelope's events.</description></item>
    ///   <item><description>Body: <see cref="EventsByEnvelope"/> — the events the server appended (with sequence + timestamp + payload), saving a follow-up GET on the happy path. The dispatcher uses these to advance its high-water mark and reconcile against its optimistic local state.</description></item>
    /// </list>
    /// </summary>
    [Tags("Events")]
    [EndpointName("postEvents")]
    [ProducesResponseType(typeof(EventsByEnvelope), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(EventsByEnvelope), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/events")]
    public static async Task<IResult> PostEvents(
        WriteEventEnvelope envelope,
        EventDispatcher dispatcher,
        IDocumentSession session,
        JsonSerializerOptions jsonOptions,
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
        if (result.Outcome == DispatchOutcome.Invalid)
            return Results.BadRequest(new ErrorResponse(result.Errors));

        var body = await BuildEventsByEnvelope(
            session,
            envelope.Id,
            result.FirstSequence,
            result.LastSequence,
            jsonOptions,
            ct
        );
        var location = $"/events/by-envelope/{envelope.Id}";
        if (result.Outcome == DispatchOutcome.Accepted)
        {
            // Results.Created sets the Location header for us.
            return Results.Created(location, body);
        }

        // Duplicate replay: representation is identical to the original
        // 201; we set Location ourselves since Results.Ok doesn't.
        response.Headers.Location = location;
        return Results.Ok(body);
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
    ///
    /// The same payload is returned inline on the <c>POST /events</c>
    /// response, so the dispatcher only needs to call this on retry
    /// after losing the original POST response (e.g. mid-flight crash).
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

        var body = await BuildEventsByEnvelope(
            session,
            id,
            record.FirstSequence,
            record.LastSequence,
            jsonOptions,
            ct
        );
        return Results.Ok(body);
    }

    /// <summary>
    /// Loads the events at <paramref name="firstSequence"/>..<paramref name="lastSequence"/>
    /// (inclusive) and shapes them into the wire-level
    /// <see cref="EventsByEnvelope"/> record. Returns an empty
    /// <c>events</c> list for an empty envelope (both bounds <c>0</c>),
    /// without hitting the event store.
    /// </summary>
    private static async Task<EventsByEnvelope> BuildEventsByEnvelope(
        IQuerySession session,
        Guid envelopeId,
        long firstSequence,
        long lastSequence,
        JsonSerializerOptions jsonOptions,
        CancellationToken ct
    )
    {
        if (lastSequence == 0)
            return new EventsByEnvelope(envelopeId, []);

        var rawEvents = await session
            .Events.QueryAllRawEvents()
            .Where(e => e.Sequence >= firstSequence && e.Sequence <= lastSequence)
            .OrderBy(e => e.Sequence)
            .ToListAsync(ct);

        var envelopes = rawEvents.Select(ToEnvelope).ToList();
        return new EventsByEnvelope(envelopeId, envelopes);

        EventEnvelope ToEnvelope(JasperFxIEvent e) =>
            new(
                e.Sequence,
                e.Id,
                EventRegistry.ByName.FirstOrDefault(kv => kv.Value == e.Data!.GetType()).Key
                    ?? e.EventTypeName,
                new DateTimeOffset(e.Timestamp.UtcDateTime, TimeSpan.Zero),
                JsonSerializer.SerializeToElement(e.Data, jsonOptions)
            );
    }
}
