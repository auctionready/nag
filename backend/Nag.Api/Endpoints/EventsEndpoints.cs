using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class EventsEndpoints
{
    /// <summary>
    /// Append the events the client emitted for a single user intent.
    /// Idempotent on <see cref="WriteEventEnvelope.Id"/>; the events are
    /// appended atomically — partial failures roll back. Empty
    /// <c>events</c> arrays reserve the envelope id and return
    /// <c>accepted=true, sequence=0</c>, keeping no-op intents
    /// retry-safe.
    /// </summary>
    [Tags("Events")]
    [EndpointName("postEvents")]
    [ProducesResponseType(typeof(WriteEventAccepted), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/events")]
    public static async Task<IResult> PostEvents(
        WriteEventEnvelope envelope,
        EventDispatcher dispatcher,
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
            DispatchOutcome.Accepted => Results.Ok(new WriteEventAccepted(true, result.Sequence)),
            DispatchOutcome.Duplicate => Results.Ok(new WriteEventAccepted(false, result.Sequence)),
            DispatchOutcome.Invalid => Results.BadRequest(new ErrorResponse(result.Errors)),
            _ => Results.StatusCode(500),
        };
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
}
