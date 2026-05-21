using JasperFx.Events;
using Marten.Events.Projections;
using Nag.Core.Events;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

/// <summary>
/// Projects every check-in event into a per-month
/// <see cref="MonthlyCheckInSummary"/> document keyed by <c>yyyy-MM</c>
/// (UTC). Lets the mobile app drop check-ins older than the previous
/// month locally and still browse history by fetching a month's
/// summary on demand.
///
/// <para>
/// <see cref="CheckInMoved"/> uses <c>Identities</c> to fan out to
/// <em>both</em> the source and the target month doc — the source
/// removes the stale row, the target upserts the new one. With the
/// <c>OldTimestamp</c> baked into the event, neither side needs to
/// look up state.
/// </para>
/// </summary>
public sealed partial class MonthlyCheckInSummaryProjection
    : MultiStreamProjection<MonthlyCheckInSummary, string>
{
    public MonthlyCheckInSummaryProjection()
    {
        Identity<CheckInRecorded>(e => MonthKeys.For(e.Timestamp));
        Identities<CheckInMoved>(e =>
            MonthKeys.For(e.OldTimestamp) == MonthKeys.For(e.NewTimestamp)
                ? new[] { MonthKeys.For(e.NewTimestamp) }
                : new[] { MonthKeys.For(e.OldTimestamp), MonthKeys.For(e.NewTimestamp) }
        );
        Identity<CheckInMarkedSkipped>(e => MonthKeys.For(e.Timestamp));
        Identity<CheckInMarkedDone>(e => MonthKeys.For(e.Timestamp));
        Identity<CheckInDeleted>(e => MonthKeys.For(e.Timestamp));
    }

    public static MonthlyCheckInSummary Create(IEvent<CheckInRecorded> e) =>
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
                        new HomeCheckIn(e.Data.CheckInId, e.Data.Timestamp, e.Data.Skipped),
                    ],
                },
            ],
        };

    public void Apply(IEvent<CheckInRecorded> e, MonthlyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        Upsert(doc.Habits, e.Data.HabitId, e.Data.CheckInId, e.Data.Timestamp, e.Data.Skipped);
    }

    public void Apply(IEvent<CheckInMoved> e, MonthlyCheckInSummary doc)
    {
        var data = e.Data;
        var oldKey = MonthKeys.For(data.OldTimestamp);
        var newKey = MonthKeys.For(data.NewTimestamp);

        if (oldKey == newKey)
        {
            // Same-period move: single slice; just update the timestamp.
            EnsureInitialized(doc);
            var existingSkipped = FindSkipped(doc.Habits, data.CheckInId) ?? false;
            Upsert(doc.Habits, data.HabitId, data.CheckInId, data.NewTimestamp, existingSkipped);
            return;
        }

        // Cross-period move: `Identities` routes the event to both old and
        // new period docs. Disambiguate the slice by the doc's contents:
        // the old-period doc already has the check-in (from `CheckInRecorded`),
        // the new-period doc doesn't. Avoids relying on Marten populating
        // `doc.Id` on freshly-created docs.
        var alreadyHasCheckIn = doc.Habits.Any(h => h.CheckIns.Any(c => c.Id == data.CheckInId));
        if (alreadyHasCheckIn)
        {
            Remove(doc.Habits, data.CheckInId);
        }
        else
        {
            if (string.IsNullOrEmpty(doc.Id))
                doc.Id = newKey;
            if (doc.MonthStart == default)
                doc.MonthStart = MonthKeys.StartOf(data.NewTimestamp);
            Upsert(doc.Habits, data.HabitId, data.CheckInId, data.NewTimestamp, false);
        }
    }

    public void Apply(IEvent<CheckInMarkedSkipped> e, MonthlyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        UpdateSkipped(doc.Habits, e.Data.CheckInId, true);
    }

    public void Apply(IEvent<CheckInMarkedDone> e, MonthlyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        UpdateSkipped(doc.Habits, e.Data.CheckInId, false);
    }

    public void Apply(IEvent<CheckInDeleted> e, MonthlyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        Remove(doc.Habits, e.Data.CheckInId);
    }

    /// <summary>
    /// When `Identities` slicing routes an event to a doc that doesn't yet
    /// exist, Marten constructs a default and sets <see cref="MonthlyCheckInSummary.Id"/>
    /// to the slice key. <see cref="MonthlyCheckInSummary.MonthStart"/> is
    /// not set automatically — derive it from the id ("yyyy-MM").
    /// </summary>
    private static void EnsureInitialized(MonthlyCheckInSummary doc)
    {
        if (doc.MonthStart != default || string.IsNullOrEmpty(doc.Id))
            return;
        var year = int.Parse(doc.Id.AsSpan(0, 4));
        var month = int.Parse(doc.Id.AsSpan(5, 2));
        doc.MonthStart = new DateTimeOffset(year, month, 1, 0, 0, 0, TimeSpan.Zero);
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

    private static void UpdateSkipped(
        List<HabitPeriodCheckIns> habits,
        Guid checkInId,
        bool skipped
    )
    {
        foreach (var habit in habits)
        {
            var idx = habit.CheckIns.FindIndex(c => c.Id == checkInId);
            if (idx < 0)
                continue;
            habit.CheckIns[idx] = habit.CheckIns[idx] with { Skipped = skipped };
            return;
        }
    }

    private static void Remove(List<HabitPeriodCheckIns> habits, Guid checkInId)
    {
        foreach (var habit in habits)
        {
            habit.CheckIns.RemoveAll(c => c.Id == checkInId);
        }
    }

    private static bool? FindSkipped(List<HabitPeriodCheckIns> habits, Guid checkInId)
    {
        foreach (var habit in habits)
        {
            var match = habit.CheckIns.FirstOrDefault(c => c.Id == checkInId);
            if (match is not null)
                return match.Skipped;
        }
        return null;
    }
}

/// <summary>
/// Sibling of <see cref="MonthlyCheckInSummaryProjection"/>, sliced by
/// week instead of month. Anchored on Monday (UTC) — the system-wide
/// default per <see cref="Nag.Core.Domain.PeriodCalculator"/>; account-level
/// overrides aren't honoured by the slicer (it'd need the account's
/// `WeekStartsOn` at slice time, and slicers are pure). Single-tenant
/// MVP, so the system anchor is fine.
/// </summary>
public sealed partial class WeeklyCheckInSummaryProjection
    : MultiStreamProjection<WeeklyCheckInSummary, string>
{
    public WeeklyCheckInSummaryProjection()
    {
        Identity<CheckInRecorded>(e => WeekKeys.For(e.Timestamp));
        Identities<CheckInMoved>(e =>
            WeekKeys.For(e.OldTimestamp) == WeekKeys.For(e.NewTimestamp)
                ? new[] { WeekKeys.For(e.NewTimestamp) }
                : new[] { WeekKeys.For(e.OldTimestamp), WeekKeys.For(e.NewTimestamp) }
        );
        Identity<CheckInMarkedSkipped>(e => WeekKeys.For(e.Timestamp));
        Identity<CheckInMarkedDone>(e => WeekKeys.For(e.Timestamp));
        Identity<CheckInDeleted>(e => WeekKeys.For(e.Timestamp));
    }

    public static WeeklyCheckInSummary Create(IEvent<CheckInRecorded> e) =>
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
                        new HomeCheckIn(e.Data.CheckInId, e.Data.Timestamp, e.Data.Skipped),
                    ],
                },
            ],
        };

    public void Apply(IEvent<CheckInRecorded> e, WeeklyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        Upsert(doc.Habits, e.Data.HabitId, e.Data.CheckInId, e.Data.Timestamp, e.Data.Skipped);
    }

    public void Apply(IEvent<CheckInMoved> e, WeeklyCheckInSummary doc)
    {
        var data = e.Data;
        var oldKey = WeekKeys.For(data.OldTimestamp);
        var newKey = WeekKeys.For(data.NewTimestamp);

        if (oldKey == newKey)
        {
            EnsureInitialized(doc);
            var existingSkipped = FindSkipped(doc.Habits, data.CheckInId) ?? false;
            Upsert(doc.Habits, data.HabitId, data.CheckInId, data.NewTimestamp, existingSkipped);
            return;
        }

        var alreadyHasCheckIn = doc.Habits.Any(h => h.CheckIns.Any(c => c.Id == data.CheckInId));
        if (alreadyHasCheckIn)
        {
            Remove(doc.Habits, data.CheckInId);
        }
        else
        {
            if (string.IsNullOrEmpty(doc.Id))
                doc.Id = newKey;
            if (doc.WeekStart == default)
                doc.WeekStart = WeekKeys.StartOf(data.NewTimestamp);
            Upsert(doc.Habits, data.HabitId, data.CheckInId, data.NewTimestamp, false);
        }
    }

    public void Apply(IEvent<CheckInMarkedSkipped> e, WeeklyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        UpdateSkipped(doc.Habits, e.Data.CheckInId, true);
    }

    public void Apply(IEvent<CheckInMarkedDone> e, WeeklyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        UpdateSkipped(doc.Habits, e.Data.CheckInId, false);
    }

    public void Apply(IEvent<CheckInDeleted> e, WeeklyCheckInSummary doc)
    {
        EnsureInitialized(doc);
        Remove(doc.Habits, e.Data.CheckInId);
    }

    /// <summary>
    /// Same role as the monthly equivalent — derive
    /// <see cref="WeeklyCheckInSummary.WeekStart"/> from the doc id
    /// ("yyyy-MM-dd") when Marten created a fresh doc for this slice.
    /// </summary>
    private static void EnsureInitialized(WeeklyCheckInSummary doc)
    {
        if (doc.WeekStart != default || string.IsNullOrEmpty(doc.Id))
            return;
        var year = int.Parse(doc.Id.AsSpan(0, 4));
        var month = int.Parse(doc.Id.AsSpan(5, 2));
        var day = int.Parse(doc.Id.AsSpan(8, 2));
        doc.WeekStart = new DateTimeOffset(year, month, day, 0, 0, 0, TimeSpan.Zero);
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

    private static void UpdateSkipped(
        List<HabitPeriodCheckIns> habits,
        Guid checkInId,
        bool skipped
    )
    {
        foreach (var habit in habits)
        {
            var idx = habit.CheckIns.FindIndex(c => c.Id == checkInId);
            if (idx < 0)
                continue;
            habit.CheckIns[idx] = habit.CheckIns[idx] with { Skipped = skipped };
            return;
        }
    }

    private static void Remove(List<HabitPeriodCheckIns> habits, Guid checkInId)
    {
        foreach (var habit in habits)
        {
            habit.CheckIns.RemoveAll(c => c.Id == checkInId);
        }
    }

    private static bool? FindSkipped(List<HabitPeriodCheckIns> habits, Guid checkInId)
    {
        foreach (var habit in habits)
        {
            var match = habit.CheckIns.FirstOrDefault(c => c.Id == checkInId);
            if (match is not null)
                return match.Skipped;
        }
        return null;
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
    // Monday-anchored to match the system-wide default in PeriodCalculator.
    private const DayOfWeek WeekStart = DayOfWeek.Monday;

    public static string For(DateTimeOffset timestamp)
    {
        var start = StartOf(timestamp);
        return $"{start.Year:D4}-{start.Month:D2}-{start.Day:D2}";
    }

    public static DateTimeOffset StartOf(DateTimeOffset timestamp)
    {
        var utc = timestamp.UtcDateTime;
        var daysSinceStart = ((int)utc.DayOfWeek - (int)WeekStart + 7) % 7;
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero).AddDays(
            -daysSinceStart
        );
    }
}
