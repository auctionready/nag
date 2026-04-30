namespace Nag.Core.Idempotency;

/// <summary>
/// Idempotency record keyed by the client-generated envelope id from
/// <c>POST /events</c>. Stored after a successful append so retries
/// of the same envelope are dedup'd to the originally-assigned
/// sequence range and skip re-appending.
///
/// <see cref="FirstSequence"/> / <see cref="LastSequence"/> bound the
/// range of events the envelope appended, so
/// <c>GET /events/by-envelope/{id}</c> can hand back exactly those
/// events without rewalking the whole stream. For empty envelopes
/// (no-op intents) both are <c>0</c>.
/// </summary>
public sealed record ProcessedEnvelope(
    Guid Id,
    long FirstSequence,
    long LastSequence,
    DateTimeOffset ProcessedAt
);
