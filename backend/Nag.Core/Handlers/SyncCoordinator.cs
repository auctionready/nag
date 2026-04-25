using Marten;
using Nag.Core.Contracts;
using Nag.Core.ReadModels;

namespace Nag.Core.Handlers;

/// <summary>
/// Decides whether a pull-sync request should replay a small batch of
/// commands or hand back a full snapshot. Snapshot mode kicks in for fresh
/// installs (<c>since == 0</c>) and for clients that have fallen far behind
/// the head sequence (gap &gt; <see cref="SnapshotThreshold"/>). The
/// snapshot is just the existing <see cref="HomeBoard"/> read model — its
/// <c>LastSequence</c> doubles as the high-water mark the client should
/// adopt after applying.
/// </summary>
public sealed class SyncCoordinator(IQuerySession session, CommandsReader reader)
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
            Commands: page.Commands,
            HeadSequence: headSequence,
            NextSince: page.NextSince
        );
    }
}
