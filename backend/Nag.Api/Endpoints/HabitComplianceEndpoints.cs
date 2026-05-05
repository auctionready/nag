using Marten;
using Microsoft.AspNetCore.Mvc;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

/// <summary>
/// Read endpoint for the habit detail screen's "How am I doing"
/// section. The mobile app calls this when the user has signed in;
/// offline / signed-out shows a sign-in CTA instead.
///
/// Unknown habit ids return an empty doc at 200 — same convention as
/// <see cref="HomeBoardEndpoints"/> and <see cref="CheckInSummaryEndpoints"/>
/// — so the client distinguishes "no events yet" via empty arrays
/// rather than a 404.
/// </summary>
public static class HabitComplianceEndpoints
{
    [Tags("Read Models")]
    [EndpointName("getHabitCompliance")]
    [ProducesResponseType(typeof(HabitComplianceHistory), StatusCodes.Status200OK)]
    [WolverineGet("/habits/{habitId:guid}/compliance")]
    public static async Task<IResult> GetHabitCompliance(
        Guid habitId,
        IQuerySession session,
        CancellationToken ct
    )
    {
        var doc = await session.LoadAsync<HabitComplianceHistory>(habitId, ct);
        return Results.Ok(doc ?? new HabitComplianceHistory { Id = habitId });
    }
}
