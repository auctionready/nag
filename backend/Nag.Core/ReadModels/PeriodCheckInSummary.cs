namespace Nag.Core.ReadModels;

/// <summary>
/// Per-habit list of check-ins observed in a given period (week or month).
/// Same shape as <see cref="HomeCheckIn"/>, grouped under a habit so the
/// client can render historical periods with the same UI it uses for the
/// live <see cref="HomeBoard"/>.
/// </summary>
public sealed record HabitPeriodCheckIns
{
    public Guid HabitId { get; init; }
    public List<HomeCheckIn> CheckIns { get; init; } = [];
}

/// <summary>
/// Materialised summary of every check-in in a single calendar month.
/// Doc id is the month key <c>"yyyy-MM"</c> (UTC-derived from the
/// check-in's deemed timestamp). Built and maintained by
/// <c>MonthlyCheckInSummaryProjection</c> as a fan-out from the global
/// command stream.
///
/// Limitations (intentional, MVP):
///  - <c>UpdateCheckIn</c> that moves a check-in across month boundaries
///    inserts the row into the new month but does not remove it from the
///    old month — UpdateCheckIn carries only the new timestamp.
///  - <c>DeleteCheckIn</c> is not applied to summaries; deleted rows
///    linger. Deletes are rare for old check-ins (the use case here).
/// Both are tolerable for a "browse the past" feature where the user is
/// inspecting a settled period that no longer mutates.
/// </summary>
public sealed class MonthlyCheckInSummary
{
    /// <summary>"yyyy-MM" (UTC) — e.g. "2026-04".</summary>
    public string Id { get; set; } = "";

    /// <summary>First instant of the month at UTC midnight.</summary>
    public DateTimeOffset MonthStart { get; set; }

    public List<HabitPeriodCheckIns> Habits { get; init; } = [];
}

/// <summary>
/// Materialised summary of every check-in in a single Sunday-anchored week.
/// Doc id is the Sunday-of-week key <c>"yyyy-MM-dd"</c> (UTC). Sunday
/// matches <see cref="Domain.PeriodCalculator"/> and the client's day-mask
/// convention. Same MVP limitations as <see cref="MonthlyCheckInSummary"/>.
/// </summary>
public sealed class WeeklyCheckInSummary
{
    /// <summary>"yyyy-MM-dd" of the Sunday starting the week (UTC).</summary>
    public string Id { get; set; } = "";

    /// <summary>The Sunday at UTC midnight that anchors the week.</summary>
    public DateTimeOffset WeekStart { get; set; }

    public List<HabitPeriodCheckIns> Habits { get; init; } = [];
}
