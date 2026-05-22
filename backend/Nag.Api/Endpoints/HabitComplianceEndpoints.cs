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
    /// <summary>
    /// Per-habit historical compliance summary the mobile app renders on the
    /// habit detail screen's "How am I doing" section. Includes the goal
    /// timeline (every <c>HabitGoalDefined</c> / <c>Cleared</c> transition
    /// with its effective-from timestamp) and a per-day compliance status
    /// (logged / missed / partial / onTrack / noGoal) covering the habit's
    /// full lifetime.
    ///
    /// Unknown habit ids return an empty doc at 200 — same convention as
    /// <c>GET /home-board</c> — so the client can distinguish "no events
    /// yet" via empty arrays rather than a 404.
    /// </summary>
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
