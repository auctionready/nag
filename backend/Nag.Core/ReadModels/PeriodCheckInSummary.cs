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
/// Cross-month staleness is bounded by the per-week period invariant
/// enforced in <see cref="Validation.CreateCheckInValidator"/> and
/// <see cref="Validation.UpdateCheckInValidator"/>: a check-in's
/// <em>week</em> is fixed at creation, but a single Sunday-anchored
/// week can straddle a month boundary, so an <c>UpdateCheckIn</c>
/// within that week may shift a check-in between adjacent months. The
/// stale entry in the outgoing month doc is the residual cost; older
/// months never observe a write after they're settled.
///
/// <c>DeleteCheckIn</c> is not applied to summaries; deleted rows
/// linger. Deletes are rare for old check-ins (the use case here).
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
/// convention.
///
/// Cross-week moves are an invariant of the per-week period validation
/// (see <see cref="Validation.CreateCheckInValidator"/> /
/// <see cref="Validation.UpdateCheckInValidator"/>): a check-in is
/// pinned to the week it was created in, so this projection never
/// observes an event whose timestamp lands in a different week from a
/// prior version of the same check-in.
///
/// <c>DeleteCheckIn</c> is not applied; deleted rows linger.
/// </summary>
public sealed class WeeklyCheckInSummary
{
    /// <summary>"yyyy-MM-dd" of the Sunday starting the week (UTC).</summary>
    public string Id { get; set; } = "";

    /// <summary>The Sunday at UTC midnight that anchors the week.</summary>
    public DateTimeOffset WeekStart { get; set; }

    public List<HabitPeriodCheckIns> Habits { get; init; } = [];
}
