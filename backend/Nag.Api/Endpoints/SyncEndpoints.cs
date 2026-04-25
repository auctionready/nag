using Microsoft.AspNetCore.Mvc;
using Nag.Core.Contracts;
using Nag.Core.Handlers;

namespace Nag.Api.Endpoints;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/sync", GetSync).WithTags("Sync").Produces<SyncResponse>();
    }

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
