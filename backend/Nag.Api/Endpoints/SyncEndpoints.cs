using Microsoft.AspNetCore.Mvc;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class SyncEndpoints
{
    /// <summary>
    /// Pull-sync for the mobile app. Given <c>since</c> (the client's
    /// high-water mark — the last sequence it has applied locally), the
    /// server returns one of two response shapes via the discriminated
    /// <c>mode</c> field:
    /// <list type="bullet">
    ///   <item><description><c>replay</c>: a page of past-tense events
    ///     with sequence &gt; <c>since</c>, plus the current
    ///     <c>headSequence</c> and an optional <c>nextSince</c> when
    ///     more pages remain. The client applies each event idempotently
    ///     and advances its high-water mark.</description></item>
    ///   <item><description><c>snapshot</c>: the entire
    ///     <c>HomeBoard</c> read model with
    ///     <c>sequenceAtSnapshot</c>. The client replaces its replicated
    ///     state and adopts <c>sequenceAtSnapshot</c> as its new
    ///     high-water mark.</description></item>
    /// </list>
    /// Snapshot mode fires when the gap to head exceeds
    /// <c>SyncCoordinator.SnapshotThreshold</c> or when <c>since == 0</c>
    /// against a populated account. An empty server account
    /// (<c>headSequence == 0</c>) always returns an empty replay rather
    /// than snapshot — snapshot mode wipes local replicated tables
    /// before reinstalling, which would clobber locally-preserved data
    /// after a "Remove server data and sign out" + sign-in.
    /// </summary>
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
