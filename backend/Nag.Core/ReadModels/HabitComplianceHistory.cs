using System.Text.Json.Serialization;
using Nag.Core.Domain;

namespace Nag.Core.ReadModels;

/// <summary>
/// Day-by-day compliance for a single habit, materialised by
/// <c>HabitComplianceHistoryProjection</c>. Used by the habit detail
/// screen's "How am I doing" section to show recent days at a glance.
///
/// Doc id = <c>HabitId</c>. Sliced from the global per-account event
/// stream by <see cref="JasperFx.Events.Projections.MultiStreamProjection{TDoc, TKey}"/>.
///
/// MVP:
///  - Per-day <c>Target</c> is only computed for daily-regularity goals.
///    Weekly/monthly goals fall back to "had a check-in or not" semantics
///    via <see cref="ComplianceStatus.Logged"/> — a per-day breakdown of
///    a weekly target is ill-defined and a UI refinement we can layer on
///    later without a wire change.
///  - No retention cap — <c>Days</c> grows with the habit's age. Keep an
///    eye on doc size; we'll add a sliding-window prune if it bites.
/// </summary>
public sealed class HabitComplianceHistory
{
    /// <summary>The habit id this history belongs to.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Append-only timeline of goal changes, ordered ascending by
    /// <see cref="GoalEpoch.EffectiveFrom"/>. Used to look up the goal
    /// in effect on any given day.
    /// </summary>
    public List<GoalEpoch> GoalTimeline { get; set; } = [];

    /// <summary>
    /// One entry per day with at least one check-in or a goal-defined
    /// target. Ordered ascending by <see cref="DailyCompliance.Date"/>.
    /// </summary>
    public List<DailyCompliance> Days { get; set; } = [];

    /// <summary>
    /// Per-check-in tracking so the projection can handle skip toggles
    /// and cross-day moves without consulting external state. Hidden
    /// from the wire — same trick <see cref="HomeBoard"/> uses for its
    /// fixed-sentinel <c>Id</c>.
    /// </summary>
    [JsonIgnore]
    public List<CheckInRef> CheckIns { get; set; } = [];
}

/// <summary>
/// One slice of the goal timeline. <see cref="Regularity"/> is null when
/// the goal was cleared at <see cref="EffectiveFrom"/>.
/// </summary>
public sealed record GoalEpoch(
    DateTimeOffset EffectiveFrom,
    Regularity? Regularity,
    int? Frequency
);

/// <summary>
/// Compliance for a single calendar day (UTC). <see cref="Date"/> is
/// "yyyy-MM-dd" so the wire format is portable across both serializers
/// without a custom converter.
/// </summary>
public sealed record DailyCompliance(string Date, int Done, int Target, ComplianceStatus Status);

/// <summary>
/// Internal tracking row — one per check-in known to this habit. Lets
/// the projection translate <see cref="Events.CheckInMarkedSkipped"/>,
/// <see cref="Events.CheckInMarkedDone"/>, <see cref="Events.CheckInMoved"/>
/// and <see cref="Events.CheckInDeleted"/> into the correct delta on
/// <see cref="DailyCompliance.Done"/>.
/// </summary>
public sealed record CheckInRef(Guid Id, string Date, bool Skipped);

public enum ComplianceStatus
{
    /// <summary>No goal active this day and no check-ins logged.</summary>
    NoGoal,

    /// <summary>
    /// At least one check-in on a day where the goal has no per-day
    /// target (weekly/monthly goal, or no goal at all). Reads as
    /// "activity recorded" — the colour palette decides whether to
    /// highlight as green.
    /// </summary>
    Logged,

    /// <summary>Per-day target &gt; 0 and no check-ins.</summary>
    Missed,

    /// <summary>Per-day target &gt; 0 and 0 &lt; done &lt; target.</summary>
    Partial,

    /// <summary>Per-day target &gt; 0 and done ≥ target.</summary>
    OnTrack,
}
