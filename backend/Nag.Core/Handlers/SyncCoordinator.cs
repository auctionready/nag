using Marten;
using Nag.Core.Contracts;
using Nag.Core.ReadModels;

namespace Nag.Core.Handlers;

/// <summary>
/// Decides whether a pull-sync request should replay a small batch of
/// past-tense events or hand back a full snapshot. Snapshot mode kicks in
/// for fresh installs (<c>since == 0</c>) against a populated account, and
/// for clients that have fallen far behind the head sequence
/// (gap &gt; <see cref="SnapshotThreshold"/>). The snapshot is just the
/// existing <see cref="HomeBoard"/> read model — its <c>LastSequence</c>
/// doubles as the high-water mark the client should adopt after applying.
///
/// Empty accounts (<c>headSequence == 0</c>) skip snapshot mode entirely
/// and return an empty replay. The client's <c>installSnapshot</c> path
/// wipes every replicated table before reinstalling from the snapshot, so
/// for a brand-new server account that's a destructive no-op — and after
/// "Remove server data and sign out" it would clobber the locally-preserved
/// habit/goal/checkIn rows that the next push is about to ship to the new
/// account.
/// </summary>
public sealed class SyncCoordinator(IQuerySession session, EventsReader reader)
{
    public const int SnapshotThreshold = 50;

    public async Task<SyncResponse> SyncAsync(long since, CancellationToken ct)
    {
        var headSequence = await session
            .Events.QueryAllRawEvents()
            .OrderByDescending(e => e.Sequence)
            .Select(e => e.Sequence)
            .FirstOrDefaultAsync(ct);

        if (since < 0)
            since = 0;

        if (headSequence == 0)
        {
            // Empty account — nothing to replay, nothing to snapshot. Returning
            // an empty replay keeps the client's local mirror intact; a
            // snapshot here would trigger `installSnapshot` and wipe the
            // outbox + replicated tables, which is the exact data the next
            // push is about to ship to this brand-new account.
            return new SyncResponse(Mode: "replay", Events: [], HeadSequence: 0, NextSince: null);
        }

        if (since == 0 || headSequence - since > SnapshotThreshold)
        {
            var board =
                await session.LoadAsync<HomeBoard>(NagStreams.Root, ct)
                ?? new HomeBoard { Id = NagStreams.Root };
            return new SyncResponse(
                Mode: "snapshot",
                SequenceAtSnapshot: board.LastSequence,
                Snapshot: board
            );
        }

        var page = await reader.ReadSinceAsync(since, limit: null, ct);
        return new SyncResponse(
            Mode: "replay",
            Events: page.Events,
            HeadSequence: headSequence,
            NextSince: page.NextSince
        );
    }
}
