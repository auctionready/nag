namespace Nag.Core.Commands;

public sealed record CreateCheckIn(
    Guid CheckInId,
    Guid HabitId,
    DateTimeOffset Timestamp,
    bool? Skipped = null
);
