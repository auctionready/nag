using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class SyncEndpoints
{
    [Tags("Sync")]
    [EndpointName("getSync")]
    [ProducesResponseType(typeof(SyncResponse), StatusCodes.Status200OK)]
    [WolverineGet("/sync")]
    public static async Task<IResult> GetSync(
        [FromQuery] long since,
        SyncCoordinator coordinator,
        CancellationToken ct
    )
    {
        var response = await coordinator.SyncAsync(since, ct);
        return Results.Ok(response);
    }
}
