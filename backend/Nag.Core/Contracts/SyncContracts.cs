using Nag.Core.ReadModels;

namespace Nag.Core.Contracts;

/// <summary>
/// Discriminated response from <c>GET /sync?since=N</c>. The
/// <see cref="Mode"/> field tells the client which payload fields are
/// populated:
/// <list type="bullet">
///   <item><c>"replay"</c>: <see cref="Events"/> + <see cref="HeadSequence"/>
///     (and <see cref="NextSince"/> if more pages await).</item>
///   <item><c>"snapshot"</c>: <see cref="SequenceAtSnapshot"/> +
///     <see cref="Snapshot"/>. Client replaces local replicated state.</item>
/// </list>
/// Modeled as a flat record (rather than <c>JsonPolymorphic</c>) because
/// Swashbuckle's polymorphic-schema support doesn't survive the
/// openapi-zod-client roundtrip — a flat shape gets a clean
/// <c>.partial()</c> in the generated zod schema.
/// </summary>
public sealed record SyncResponse(
    string Mode,
    IReadOnlyList<EventEnvelope>? Events = null,
    long? HeadSequence = null,
    long? NextSince = null,
    long? SequenceAtSnapshot = null,
    HomeBoard? Snapshot = null
);
