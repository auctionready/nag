using Marten;
using Microsoft.AspNetCore.Mvc;
using Nag.Core;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class HomeBoardEndpoints
{
    [Tags("Read Models")]
    [EndpointName("getHomeBoard")]
    [ProducesResponseType(typeof(HomeBoard), StatusCodes.Status200OK)]
    [WolverineGet("/home-board")]
    public static async Task<IResult> GetHomeBoard(IQuerySession session, CancellationToken ct)
    {
        var board = await session.LoadAsync<HomeBoard>(NagStreams.Root, ct);
        return Results.Ok(board ?? new HomeBoard { Id = NagStreams.Root });
    }
}
