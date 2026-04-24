using Nag.Core.Domain;

namespace Nag.Core.Commands;

public sealed record UpdateHabit(
    Guid HabitId,
    string? Title = null,
    string? Description = null,
    string? Icon = null,
    GoalPayload? Goal = null,
    bool ClearDescription = false,
    bool ClearIcon = false,
    bool ClearGoal = false
);
