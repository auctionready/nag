using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class EventsEndpoints
{
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
