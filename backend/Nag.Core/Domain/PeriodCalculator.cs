namespace Nag.Core.Domain;

public static class PeriodCalculator
{
    public static (DateTimeOffset Start, DateTimeOffset End) CurrentPeriod(
        Regularity regularity,
        DateTimeOffset now
    )
    {
        var utc = now.ToUniversalTime();
        return regularity switch
        {
            Regularity.Day => (
                new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero).AddDays(1)
            ),
            Regularity.Week => WeekBounds(utc),
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
        DateTimeOffset now
    )
    {
        var (start, end) = CurrentPeriod(regularity, now);
        var t = timestamp.ToUniversalTime();
        return t >= start && t < end;
    }

    private static (DateTimeOffset Start, DateTimeOffset End) WeekBounds(DateTimeOffset utc)
    {
        // Week starts Sunday (matches client schedule day bitmask: Sun=1).
        var daysSinceSunday = (int)utc.DayOfWeek;
        var start = new DateTimeOffset(
            utc.Year,
            utc.Month,
            utc.Day,
            0,
            0,
            0,
            TimeSpan.Zero
        ).AddDays(-daysSinceSunday);
        return (start, start.AddDays(7));
    }
}
