using Nag.Core.Domain;

namespace Nag.Core.Events;

/// <summary>
/// A new habit was created. Emitted by the server in response to a
/// <c>CreateHabit</c> command. Carries the initial goal (if any) inline
/// rather than as a separate <see cref="HabitGoalDefined"/> event so a
/// snapshot of a single habit needs only one event.
/// </summary>
public sealed record HabitCreated(
    Guid HabitId,
    string Title,
    string? Description = null,
    string? Icon = null,
    GoalPayload? Goal = null
);

/// <summary>
/// One or more of a habit's editorial fields (title, description, icon)
/// were changed. Goal changes are out of scope — see
/// <see cref="HabitGoalDefined"/> / <see cref="HabitGoalCleared"/>.
///
/// <para>
/// Optional fields encode "new value" and the matching <c>Clear*</c> flag
/// encodes "explicit null" for nullable fields. A field absent from the
/// event was unchanged. Title is required (it can't be cleared).
/// </para>
/// </summary>
public sealed record HabitDetailsEdited(
    Guid HabitId,
    string? Title = null,
    string? Description = null,
    bool ClearDescription = false,
    string? Icon = null,
    bool ClearIcon = false
);

/// <summary>
/// A habit's goal was set or replaced. Carries the full new goal
/// (regularity, frequency-or-schedules) — projections replace the prior
/// goal wholesale.
/// </summary>
public sealed record HabitGoalDefined(
    Guid HabitId,
    Regularity Regularity,
    int? Frequency = null,
    IReadOnlyList<ScheduleEntry>? Schedules = null
);

/// <summary>
/// A habit's goal was removed. The habit remains; only the goal is gone.
/// </summary>
public sealed record HabitGoalCleared(Guid HabitId);

/// <summary>
/// A habit was deleted. Cascades to its check-ins on the projection side.
/// </summary>
public sealed record HabitDeleted(Guid HabitId);
