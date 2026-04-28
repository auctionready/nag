namespace Nag.Core.Domain;

public static class PeriodCalculator
{
    public static (DateTimeOffset Start, DateTimeOffset End) CurrentPeriod(
        Regularity regularity,
        DateTimeOffset now,
        DayOfWeek weekStartsOn = DayOfWeek.Monday
    )
    {
        var utc = now.ToUniversalTime();
        return regularity switch
        {
            Regularity.Day => (
                new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero).AddDays(1)
            ),
            Regularity.Week => WeekBounds(utc, weekStartsOn),
            Regularity.Month => (
                new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(1)
            ),
            _ => throw new ArgumentOutOfRangeException(nameof(regularity)),
        };
    }

    public static bool IsInCurrentPeriod(
        Regularity regularity,
        DateTimeOffset timestamp,
        DateTimeOffset now,
        DayOfWeek weekStartsOn = DayOfWeek.Monday
    )
    {
        var (start, end) = CurrentPeriod(regularity, now, weekStartsOn);
        var t = timestamp.ToUniversalTime();
        return t >= start && t < end;
    }

    /// <summary>
    /// Bounds of the week that contains <paramref name="utc"/>, anchored on
    /// the configured <paramref name="weekStartsOn"/> day. End is the same
    /// day-of-week one week later, exclusive.
    /// </summary>
    private static (DateTimeOffset Start, DateTimeOffset End) WeekBounds(
        DateTimeOffset utc,
        DayOfWeek weekStartsOn
    )
    {
        var daysSinceStart = ((int)utc.DayOfWeek - (int)weekStartsOn + 7) % 7;
        var start = new DateTimeOffset(
            utc.Year,
            utc.Month,
            utc.Day,
            0,
            0,
            0,
            TimeSpan.Zero
        ).AddDays(-daysSinceStart);
        return (start, start.AddDays(7));
    }
}
