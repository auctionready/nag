using JasperFx.Events;
using Marten.Events.Aggregation;
using Nag.Core.Commands;
using Nag.Core.Domain;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

public sealed class HomeBoardProjection : SingleStreamProjection<HomeBoard, Guid>
{
    public HomeBoardProjection()
    {
        // Single document keyed by NagStreams.Root.
    }

    public static HomeBoard Create(IEvent<CreateHabit> e) =>
        new()
        {
            Id = NagStreams.Root,
            LastSequence = e.Sequence,
            Habits =
            [
                new HomeHabit
                {
                    Id = e.Data.HabitId,
                    Title = e.Data.Title,
                    Description = e.Data.Description,
                    Icon = e.Data.Icon,
                    Goal = e.Data.Goal is null
                        ? null
                        : new HomeGoal(e.Data.Goal.Regularity, e.Data.Goal.Frequency),
                    Schedules = e.Data.Goal?.Schedules is null
                        ? []
                        : [.. e.Data.Goal.Schedules.Select(MapSchedule)],
                    PeriodCheckIns = [],
                },
            ],
        };

    public void Apply(IEvent<CreateHabit> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var cmd = e.Data;
        board.Habits.RemoveAll(h => h.Id == cmd.HabitId);
        board.Habits.Add(
            new HomeHabit
            {
                Id = cmd.HabitId,
                Title = cmd.Title,
                Description = cmd.Description,
                Icon = cmd.Icon,
                Goal = cmd.Goal is null
                    ? null
                    : new HomeGoal(cmd.Goal.Regularity, cmd.Goal.Frequency),
                Schedules = cmd.Goal?.Schedules is null
                    ? []
                    : [.. cmd.Goal.Schedules.Select(MapSchedule)],
                PeriodCheckIns = [],
            }
        );
    }

    public void Apply(IEvent<UpdateHabit> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var cmd = e.Data;
        var habit = board.Habits.FirstOrDefault(h => h.Id == cmd.HabitId);
        if (habit is null)
            return;

        var idx = board.Habits.IndexOf(habit);
        var description = cmd.ClearDescription ? null : (cmd.Description ?? habit.Description);
        var icon = cmd.ClearIcon ? null : (cmd.Icon ?? habit.Icon);
        var goal =
            cmd.ClearGoal ? null
            : cmd.Goal is null ? habit.Goal
            : new HomeGoal(cmd.Goal.Regularity, cmd.Goal.Frequency);
        var schedules =
            cmd.ClearGoal ? []
            : cmd.Goal?.Schedules is null ? habit.Schedules
            : [.. cmd.Goal.Schedules.Select(MapSchedule)];

        board.Habits[idx] = habit with
        {
            Title = cmd.Title ?? habit.Title,
            Description = description,
            Icon = icon,
            Goal = goal,
            Schedules = schedules,
        };
    }

    public void Apply(IEvent<DeleteHabit> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        board.Habits.RemoveAll(h => h.Id == e.Data.HabitId);
    }

    public void Apply(IEvent<CreateCheckIn> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var cmd = e.Data;
        var habit = board.Habits.FirstOrDefault(h => h.Id == cmd.HabitId);
        if (habit is null)
            return;

        habit.PeriodCheckIns.RemoveAll(c => c.Id == cmd.CheckInId);
        habit.PeriodCheckIns.Add(
            new HomeCheckIn(cmd.CheckInId, cmd.Timestamp, cmd.Skipped ?? false)
        );

        PrunePeriodCheckIns(habit, cmd.Timestamp);
    }

    public void Apply(IEvent<UpdateCheckIn> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var cmd = e.Data;
        foreach (var habit in board.Habits)
        {
            var idx = habit.PeriodCheckIns.FindIndex(c => c.Id == cmd.CheckInId);
            if (idx < 0)
                continue;

            habit.PeriodCheckIns[idx] = habit.PeriodCheckIns[idx] with
            {
                Timestamp = cmd.Timestamp,
                Skipped = cmd.Skipped ?? habit.PeriodCheckIns[idx].Skipped,
            };
            PrunePeriodCheckIns(habit, cmd.Timestamp);
            return;
        }
    }

    public void Apply(IEvent<DeleteCheckIn> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var cmd = e.Data;
        foreach (var habit in board.Habits)
        {
            habit.PeriodCheckIns.RemoveAll(c => c.Id == cmd.CheckInId);
        }
    }

    private static HomeSchedule MapSchedule(ScheduleEntry e) =>
        new(e.Hour, e.Minute, e.Days, e.DayOfMonth, e.Reminder ?? true);

    private static void PrunePeriodCheckIns(HomeHabit habit, DateTimeOffset reference)
    {
        if (habit.Goal is null)
            return;
        var (start, end) = PeriodCalculator.CurrentPeriod(habit.Goal.Regularity, reference);
        habit.PeriodCheckIns.RemoveAll(c => c.Timestamp < start || c.Timestamp >= end);
    }
}
