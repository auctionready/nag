namespace Nag.Core.ReadModels;

/// <summary>
/// Per-check-in projection of "what is this check-in's current state?".
/// The <see cref="Handlers.CommandDispatcher"/> reads it to fill in the
/// `OldTimestamp` on <c>CheckInMoved</c> and the `Timestamp` on
/// <c>CheckInDeleted</c> — both are needed so the per-period summary
/// projections can route those events to the right period doc without
/// any further lookup.
///
/// Tombstoned (rather than deleted) on <c>CheckInDeleted</c> so a
/// post-delete <c>Update</c> / <c>Delete</c> is rejected by the
/// dispatcher's "still alive?" check rather than silently re-creating
/// the entry.
/// </summary>
public sealed class CheckInState
{
    public Guid Id { get; set; }
    public Guid HabitId { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public bool Skipped { get; set; }
    public bool Deleted { get; set; }
}
