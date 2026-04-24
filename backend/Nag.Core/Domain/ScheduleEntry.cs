namespace Nag.Core.Domain;

public sealed record ScheduleEntry(
    int Hour,
    int Minute,
    int? Days = null,
    int? DayOfMonth = null,
    bool? Reminder = null
);
