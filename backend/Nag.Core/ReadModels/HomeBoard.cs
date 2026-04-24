using Nag.Core.Domain;

namespace Nag.Core.ReadModels;

public sealed record HomeBoard
{
    public Guid Id { get; init; } = NagStreams.Root;
    public long LastSequence { get; init; }
    public List<HomeHabit> Habits { get; init; } = new();
}

public sealed record HomeHabit
{
    public Guid Id { get; init; }
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public HomeGoal? Goal { get; init; }
    public List<HomeSchedule> Schedules { get; init; } = new();
    public List<HomeCheckIn> PeriodCheckIns { get; init; } = new();
}

public sealed record HomeGoal(Regularity Regularity, int? Frequency);

public sealed record HomeSchedule(int Hour, int Minute, int? Days, int? DayOfMonth, bool Reminder);

public sealed record HomeCheckIn(Guid Id, DateTimeOffset Timestamp, bool Skipped);
