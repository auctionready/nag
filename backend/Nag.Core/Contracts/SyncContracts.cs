using System.Text.Json.Serialization;
using Nag.Core.ReadModels;

namespace Nag.Core.Contracts;

/// <summary>
/// Discriminated response from <c>GET /sync?since=N</c>. The client picks
/// the apply path based on <c>Mode</c>:
/// <list type="bullet">
///   <item><c>replay</c>: apply <see cref="SyncReplayResponse.Commands"/> in
///     ascending sequence; if <c>NextSince</c> is non-null, more await on
///     the next call.</item>
///   <item><c>snapshot</c>: replace local replicated state with
///     <see cref="SyncSnapshotResponse.Snapshot"/> and advance the
///     high-water mark to <c>SequenceAtSnapshot</c>.</item>
/// </list>
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "mode")]
[JsonDerivedType(typeof(SyncReplayResponse), typeDiscriminator: "replay")]
[JsonDerivedType(typeof(SyncSnapshotResponse), typeDiscriminator: "snapshot")]
public abstract record SyncResponse;

public sealed record SyncReplayResponse(
    IReadOnlyList<CommandEnvelopeOut> Commands,
    long HeadSequence,
    long? NextSince
) : SyncResponse;

public sealed record SyncSnapshotResponse(long SequenceAtSnapshot, HomeBoard Snapshot)
    : SyncResponse;
