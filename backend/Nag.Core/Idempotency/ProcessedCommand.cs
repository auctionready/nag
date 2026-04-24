namespace Nag.Core.Idempotency;

public sealed record ProcessedCommand(Guid Id, long Sequence, DateTimeOffset ProcessedAt);
