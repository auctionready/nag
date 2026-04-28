using JasperFx.Events;
using Marten.Events.Projections;
using Nag.Core.Commands;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

/// <summary>
/// Projects every <c>CreateCheckIn</c> / <c>UpdateCheckIn</c> into a
/// per-month <see cref="MonthlyCheckInSummary"/> document keyed by
/// <c>yyyy-MM</c> (UTC). Lets the mobile app drop check-ins older than
/// the previous month locally and still browse history by fetching a
/// month's summary on demand.
/// </summary>
public sealed class MonthlyCheckInSummaryProjection
    : MultiStreamProjection<MonthlyCheckInSummary, string>
{
    public MonthlyCheckInSummaryProjection()
    {
        Identity<CreateCheckIn>(e => MonthKeys.For(e.Timestamp));
        Identity<UpdateCheckIn>(e => MonthKeys.For(e.Timestamp));
    }

    public static MonthlyCheckInSummary Create(IEvent<CreateCheckIn> e) =>
        new()
        {
            Id = MonthKeys.For(e.Data.Timestamp),
            MonthStart = MonthKeys.StartOf(e.Data.Timestamp),
            Habits =
            [
                new HabitPeriodCheckIns
                {
                    HabitId = e.Data.HabitId,
                    CheckIns =
                    [
                        new HomeCheckIn(
                            e.Data.CheckInId,
                            e.Data.Timestamp,
                            e.Data.Skipped ?? false
                        ),
                    ],
                },
            ],
        };

    public void Apply(IEvent<CreateCheckIn> e, MonthlyCheckInSummary doc)
    {
        Upsert(
            doc.Habits,
            e.Data.HabitId,
            e.Data.CheckInId,
            e.Data.Timestamp,
            e.Data.Skipped ?? false
        );
    }

    public void Apply(IEvent<UpdateCheckIn> e, MonthlyCheckInSummary doc)
    {
        // UpdateCheckIn only knows the check-in id. Locate it across habits
        // and patch in place. If the new timestamp moved the check-in from
        // a different month, this routes to the *new* month doc and the
        // old month is left stale (see XML doc on the read model).
        foreach (var habit in doc.Habits)
        {
            var idx = habit.CheckIns.FindIndex(c => c.Id == e.Data.CheckInId);
            if (idx < 0)
                continue;
            habit.CheckIns[idx] = habit.CheckIns[idx] with
            {
                Timestamp = e.Data.Timestamp,
                Skipped = e.Data.Skipped ?? habit.CheckIns[idx].Skipped,
            };
            return;
        }
    }

    private static void Upsert(
        List<HabitPeriodCheckIns> habits,
        Guid habitId,
        Guid checkInId,
        DateTimeOffset timestamp,
        bool skipped
    )
    {
        var habit = habits.FirstOrDefault(h => h.HabitId == habitId);
        if (habit is null)
        {
            habits.Add(
                new HabitPeriodCheckIns
                {
                    HabitId = habitId,
                    CheckIns = [new HomeCheckIn(checkInId, timestamp, skipped)],
                }
            );
            return;
        }
        habit.CheckIns.RemoveAll(c => c.Id == checkInId);
        habit.CheckIns.Add(new HomeCheckIn(checkInId, timestamp, skipped));
    }
}

/// <summary>
/// Same shape as <see cref="MonthlyCheckInSummaryProjection"/>, sliced by
/// Sunday-anchored week instead of month. Sunday matches
/// <see cref="Nag.Core.Domain.PeriodCalculator"/>.
/// </summary>
public sealed class WeeklyCheckInSummaryProjection
    : MultiStreamProjection<WeeklyCheckInSummary, string>
{
    public WeeklyCheckInSummaryProjection()
    {
        Identity<CreateCheckIn>(e => WeekKeys.For(e.Timestamp));
        Identity<UpdateCheckIn>(e => WeekKeys.For(e.Timestamp));
    }

    public static WeeklyCheckInSummary Create(IEvent<CreateCheckIn> e) =>
        new()
        {
            Id = WeekKeys.For(e.Data.Timestamp),
            WeekStart = WeekKeys.StartOf(e.Data.Timestamp),
            Habits =
            [
                new HabitPeriodCheckIns
                {
                    HabitId = e.Data.HabitId,
                    CheckIns =
                    [
                        new HomeCheckIn(
                            e.Data.CheckInId,
                            e.Data.Timestamp,
                            e.Data.Skipped ?? false
                        ),
                    ],
                },
            ],
        };

    public void Apply(IEvent<CreateCheckIn> e, WeeklyCheckInSummary doc)
    {
        var habit = doc.Habits.FirstOrDefault(h => h.HabitId == e.Data.HabitId);
        if (habit is null)
        {
            doc.Habits.Add(
                new HabitPeriodCheckIns
                {
                    HabitId = e.Data.HabitId,
                    CheckIns =
                    [
                        new HomeCheckIn(
                            e.Data.CheckInId,
                            e.Data.Timestamp,
                            e.Data.Skipped ?? false
                        ),
                    ],
                }
            );
            return;
        }
        habit.CheckIns.RemoveAll(c => c.Id == e.Data.CheckInId);
        habit.CheckIns.Add(
            new HomeCheckIn(e.Data.CheckInId, e.Data.Timestamp, e.Data.Skipped ?? false)
        );
    }

    public void Apply(IEvent<UpdateCheckIn> e, WeeklyCheckInSummary doc)
    {
        foreach (var habit in doc.Habits)
        {
            var idx = habit.CheckIns.FindIndex(c => c.Id == e.Data.CheckInId);
            if (idx < 0)
                continue;
            habit.CheckIns[idx] = habit.CheckIns[idx] with
            {
                Timestamp = e.Data.Timestamp,
                Skipped = e.Data.Skipped ?? habit.CheckIns[idx].Skipped,
            };
            return;
        }
    }
}

internal static class MonthKeys
{
    public static string For(DateTimeOffset timestamp)
    {
        var utc = timestamp.UtcDateTime;
        return $"{utc.Year:D4}-{utc.Month:D2}";
    }

    public static DateTimeOffset StartOf(DateTimeOffset timestamp)
    {
        var utc = timestamp.UtcDateTime;
        return new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}

internal static class WeekKeys
{
    public static string For(DateTimeOffset timestamp)
    {
        var start = StartOf(timestamp);
        return $"{start.Year:D4}-{start.Month:D2}-{start.Day:D2}";
    }

    public static DateTimeOffset StartOf(DateTimeOffset timestamp)
    {
        var utc = timestamp.UtcDateTime;
        var daysSinceSunday = (int)utc.DayOfWeek;
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero).AddDays(
            -daysSinceSunday
        );
    }
}
