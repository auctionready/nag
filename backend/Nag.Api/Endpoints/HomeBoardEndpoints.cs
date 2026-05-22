using Marten;
using Microsoft.AspNetCore.Mvc;
using Nag.Core;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class HomeBoardEndpoints
{
    /// <summary>
    /// Materialised current-period view: every habit on the calling account,
    /// each with its goal, schedules, and current-period check-ins (today
    /// for daily habits, this calendar week / month for weekly / monthly).
    /// Maintained as an inline projection so a read immediately after a
    /// successful <c>POST /events</c> sees the change.
    ///
    /// Unknown / empty accounts return an empty-shaped <c>HomeBoard</c> at
    /// 200 rather than 404 — the client treats "no habits yet" the same as
    /// "fresh server, no events".
    /// </summary>
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
