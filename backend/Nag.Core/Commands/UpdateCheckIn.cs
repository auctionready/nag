namespace Nag.Core.Commands;

public sealed record UpdateCheckIn(Guid CheckInId, DateTimeOffset Timestamp, bool? Skipped = null);
