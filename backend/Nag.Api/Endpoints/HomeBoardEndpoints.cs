using Marten;
using Nag.Core;
using Nag.Core.ReadModels;

namespace Nag.Api.Endpoints;

public static class HomeBoardEndpoints
{
    public static void MapHomeBoardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/home-board", GetHomeBoard).WithTags("Read Models").Produces<HomeBoard>();
    }

    public static async Task<IResult> GetHomeBoard(IQuerySession session, CancellationToken ct)
    {
        var board = await session.LoadAsync<HomeBoard>(NagStreams.Root, ct);
        return Results.Ok(board ?? new HomeBoard { Id = NagStreams.Root });
    }
}
