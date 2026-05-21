using JasperFx.Events;
using Marten.Events.Aggregation;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

/// <summary>
/// The home-screen read model: every habit + its current-period check-ins.
/// Single document keyed by <see cref="NagStreams.Root"/>; consumes the
/// past-tense event stream emitted by <see cref="Handlers.CommandDispatcher"/>.
/// </summary>
public sealed partial class HomeBoardProjection : SingleStreamProjection<HomeBoard, Guid>
{
    public HomeBoardProjection() { }

    public static HomeBoard Create(IEvent<HabitCreated> e) =>
        new()
        {
            Id = NagStreams.Root,
            LastSequence = e.Sequence,
            Habits = [BuildHabit(e.Data)],
        };

    public void Apply(IEvent<HabitCreated> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        board.Habits.RemoveAll(h => h.Id == data.HabitId);
        board.Habits.Add(BuildHabit(data));
    }

    public void Apply(IEvent<HabitDetailsEdited> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        var idx = board.Habits.FindIndex(h => h.Id == data.HabitId);
        if (idx < 0)
            return;

        var habit = board.Habits[idx];
        var description = data.ClearDescription ? null : (data.Description ?? habit.Description);
        var icon = data.ClearIcon ? null : (data.Icon ?? habit.Icon);
        board.Habits[idx] = habit with
        {
            Title = data.Title ?? habit.Title,
            Description = description,
            Icon = icon,
        };
    }

    public void Apply(IEvent<HabitGoalDefined> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        var idx = board.Habits.FindIndex(h => h.Id == data.HabitId);
        if (idx < 0)
            return;

        var habit = board.Habits[idx];
        board.Habits[idx] = habit with
        {
            Goal = new HomeGoal(data.Regularity, data.Frequency),
            Schedules = data.Schedules is null ? [] : [.. data.Schedules.Select(MapSchedule)],
        };
    }

    public void Apply(IEvent<HabitGoalCleared> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var idx = board.Habits.FindIndex(h => h.Id == e.Data.HabitId);
        if (idx < 0)
            return;

        var habit = board.Habits[idx];
        board.Habits[idx] = habit with { Goal = null, Schedules = [] };
    }

    public void Apply(IEvent<HabitDeleted> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        board.Habits.RemoveAll(h => h.Id == e.Data.HabitId);
    }

    public void Apply(IEvent<CheckInRecorded> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        var habit = board.Habits.FirstOrDefault(h => h.Id == data.HabitId);
        if (habit is null)
            return;

        habit.PeriodCheckIns.RemoveAll(c => c.Id == data.CheckInId);
        habit.PeriodCheckIns.Add(new HomeCheckIn(data.CheckInId, data.Timestamp, data.Skipped));
        PrunePeriodCheckIns(habit, data.Timestamp);
    }

    public void Apply(IEvent<CheckInMoved> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        var habit = board.Habits.FirstOrDefault(h => h.Id == data.HabitId);
        if (habit is null)
            return;

        var idx = habit.PeriodCheckIns.FindIndex(c => c.Id == data.CheckInId);
        if (idx >= 0)
        {
            habit.PeriodCheckIns[idx] = habit.PeriodCheckIns[idx] with
            {
                Timestamp = data.NewTimestamp,
            };
        }
        else
        {
            // The old timestamp may have been outside the current period and
            // therefore pruned; the new timestamp may now be inside. Fall
            // back to inserting fresh — Skipped defaults to false because
            // we don't have it in the move event; subsequent
            // MarkedSkipped/Done events will correct it.
            habit.PeriodCheckIns.Add(new HomeCheckIn(data.CheckInId, data.NewTimestamp, false));
        }
        PrunePeriodCheckIns(habit, data.NewTimestamp);
    }

    public void Apply(IEvent<CheckInMarkedSkipped> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        UpdateSkipped(board, e.Data.CheckInId, true);
    }

    public void Apply(IEvent<CheckInMarkedDone> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        UpdateSkipped(board, e.Data.CheckInId, false);
    }

    public void Apply(IEvent<CheckInDeleted> e, HomeBoard board)
    {
        board.LastSequence = e.Sequence;
        var data = e.Data;
        var habit = board.Habits.FirstOrDefault(h => h.Id == data.HabitId);
        habit?.PeriodCheckIns.RemoveAll(c => c.Id == data.CheckInId);
    }

    private static void UpdateSkipped(HomeBoard board, Guid checkInId, bool skipped)
    {
        foreach (var habit in board.Habits)
        {
            var idx = habit.PeriodCheckIns.FindIndex(c => c.Id == checkInId);
            if (idx < 0)
                continue;
            habit.PeriodCheckIns[idx] = habit.PeriodCheckIns[idx] with { Skipped = skipped };
            return;
        }
    }

    private static HomeHabit BuildHabit(HabitCreated data) =>
        new()
        {
            Id = data.HabitId,
            Title = data.Title,
            Description = data.Description,
            Icon = data.Icon,
            Goal = data.Goal is null
                ? null
                : new HomeGoal(data.Goal.Regularity, data.Goal.Frequency),
            Schedules = data.Goal?.Schedules is null
                ? []
                : [.. data.Goal.Schedules.Select(MapSchedule)],
            PeriodCheckIns = [],
        };

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
