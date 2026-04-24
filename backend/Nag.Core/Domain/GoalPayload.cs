namespace Nag.Core.Domain;

public sealed record GoalPayload(
    Regularity Regularity,
    int? Frequency = null,
    IReadOnlyList<ScheduleEntry>? Schedules = null
);
