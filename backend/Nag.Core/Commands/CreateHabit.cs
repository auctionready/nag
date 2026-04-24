using Nag.Core.Domain;

namespace Nag.Core.Commands;

public sealed record CreateHabit(
    Guid HabitId,
    string Title,
    string? Description = null,
    string? Icon = null,
    GoalPayload? Goal = null
);
