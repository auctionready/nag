using System.Text.Json.Serialization;
using Nag.Core.Domain;

namespace Nag.Core.ReadModels;

public sealed class HomeBoard
{
    /// <summary>
    /// Marten document key — always <see cref="NagStreams.Root"/>. Hidden from
    /// the wire because (a) it's a backend implementation detail and (b) the
    /// fixed sentinel <c>11111111-1111-1111-1111-111111111111</c> isn't a
    /// valid RFC 4122 UUID, so client-side Zod validators reject it.
    /// </summary>
    [JsonIgnore]
    public Guid Id { get; init; } = NagStreams.Root;
    public long LastSequence { get; set; }
    public List<HomeHabit> Habits { get; init; } = [];
}

public sealed record HomeHabit
{
    public Guid Id { get; init; }
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public HomeGoal? Goal { get; init; }
    public List<HomeSchedule> Schedules { get; init; } = [];
    public List<HomeCheckIn> PeriodCheckIns { get; init; } = [];

    /// <summary>Set when the habit is archived (hidden from the board).</summary>
    public DateTimeOffset? ArchivedAt { get; init; }

    /// <summary>Set when the habit is paused (off the schedule, demoted).</summary>
    public DateTimeOffset? PausedAt { get; init; }
}

public sealed record HomeGoal(Regularity Regularity, int? Frequency);

public sealed record HomeSchedule(int Hour, int Minute, int? Days, int? DayOfMonth, bool Reminder);

public sealed record HomeCheckIn(Guid Id, DateTimeOffset Timestamp, bool Skipped);
