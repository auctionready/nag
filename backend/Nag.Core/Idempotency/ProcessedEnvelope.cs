namespace Nag.Core.Idempotency;

/// <summary>
/// Idempotency record keyed by the client-generated envelope id from
/// <c>POST /events</c>. Stored after a successful append so retries of
/// the same envelope return the originally-assigned <see cref="Sequence"/>
/// and skip re-appending.
/// </summary>
public sealed record ProcessedEnvelope(Guid Id, long Sequence, DateTimeOffset ProcessedAt);
