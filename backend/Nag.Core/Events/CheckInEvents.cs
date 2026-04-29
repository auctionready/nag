namespace Nag.Core.Events;

/// <summary>
/// A check-in was recorded for a habit. Initial state — subsequent
/// changes use <see cref="CheckInMoved"/> for timestamp shifts and
/// <see cref="CheckInMarkedSkipped"/> / <see cref="CheckInMarkedDone"/>
/// for skip toggles.
/// </summary>
public sealed record CheckInRecorded(
    Guid CheckInId,
    Guid HabitId,
    DateTimeOffset Timestamp,
    bool Skipped = false
);

/// <summary>
/// A check-in's deemed timestamp was changed. Both the prior and the new
/// timestamp are baked into the event so per-period summary projections
/// can route to both the old period's doc (to remove the stale row) and
/// the new period's doc (to upsert) via <c>Identities</c> slicing.
/// </summary>
public sealed record CheckInMoved(
    Guid CheckInId,
    Guid HabitId,
    DateTimeOffset OldTimestamp,
    DateTimeOffset NewTimestamp
);

/// <summary>
/// A check-in was marked as a skip rather than a completion. Carries
/// the check-in's current `Timestamp` (looked up by the dispatcher from
/// <see cref="ReadModels.CheckInState"/>) so the per-period summary
/// projection can slice by period without an external state lookup.
/// </summary>
public sealed record CheckInMarkedSkipped(Guid CheckInId, Guid HabitId, DateTimeOffset Timestamp);

/// <summary>
/// A check-in was un-skipped (marked as a completion). Same `Timestamp`
/// rationale as <see cref="CheckInMarkedSkipped"/>.
/// </summary>
public sealed record CheckInMarkedDone(Guid CheckInId, Guid HabitId, DateTimeOffset Timestamp);

/// <summary>
/// A check-in was deleted. Carries the timestamp the check-in had at
/// delete time so the per-period summary projection's slicer can route
/// the delete to the right period doc without a state lookup.
/// </summary>
public sealed record CheckInDeleted(Guid CheckInId, Guid HabitId, DateTimeOffset Timestamp);
