using Nag.Core.Domain;
using Shouldly;
using Xunit;

namespace Nag.Tests.Core.Domain;

public class PeriodCalculatorTests
{
    public class CurrentPeriod_Day
    {
        private readonly DateTimeOffset _now = new(2026, 4, 24, 14, 30, 0, TimeSpan.Zero);

        [Fact]
        public void starts_at_midnight_utc()
        {
            var (start, _) = PeriodCalculator.CurrentPeriod(Regularity.Day, _now);
            start.ShouldBe(new DateTimeOffset(2026, 4, 24, 0, 0, 0, TimeSpan.Zero));
        }

        [Fact]
        public void ends_at_next_midnight_utc()
        {
            var (_, end) = PeriodCalculator.CurrentPeriod(Regularity.Day, _now);
            end.ShouldBe(new DateTimeOffset(2026, 4, 25, 0, 0, 0, TimeSpan.Zero));
        }
    }

    public class CurrentPeriod_Week
    {
        private readonly DateTimeOffset _friday = new(2026, 4, 24, 14, 30, 0, TimeSpan.Zero);

        [Fact]
        public void starts_on_previous_sunday()
        {
            var (start, _) = PeriodCalculator.CurrentPeriod(Regularity.Week, _friday);
            start.DayOfWeek.ShouldBe(DayOfWeek.Sunday);
            start.ShouldBe(new DateTimeOffset(2026, 4, 19, 0, 0, 0, TimeSpan.Zero));
        }

        [Fact]
        public void spans_seven_days()
        {
            var (start, end) = PeriodCalculator.CurrentPeriod(Regularity.Week, _friday);
            (end - start).ShouldBe(TimeSpan.FromDays(7));
        }
    }

    public class CurrentPeriod_Month
    {
        private readonly DateTimeOffset _now = new(2026, 4, 24, 14, 30, 0, TimeSpan.Zero);

        [Fact]
        public void starts_on_first_of_month()
        {
            var (start, _) = PeriodCalculator.CurrentPeriod(Regularity.Month, _now);
            start.ShouldBe(new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero));
        }

        [Fact]
        public void ends_on_first_of_next_month()
        {
            var (_, end) = PeriodCalculator.CurrentPeriod(Regularity.Month, _now);
            end.ShouldBe(new DateTimeOffset(2026, 5, 1, 0, 0, 0, TimeSpan.Zero));
        }
    }

    public class IsInCurrentPeriod
    {
        private readonly DateTimeOffset _now = new(2026, 4, 24, 14, 30, 0, TimeSpan.Zero);

        [Fact]
        public void includes_timestamp_inside_today()
        {
            PeriodCalculator
                .IsInCurrentPeriod(
                    Regularity.Day,
                    new DateTimeOffset(2026, 4, 24, 8, 0, 0, TimeSpan.Zero),
                    _now
                )
                .ShouldBeTrue();
        }

        [Fact]
        public void excludes_timestamp_from_yesterday()
        {
            PeriodCalculator
                .IsInCurrentPeriod(
                    Regularity.Day,
                    new DateTimeOffset(2026, 4, 23, 23, 59, 0, TimeSpan.Zero),
                    _now
                )
                .ShouldBeFalse();
        }
    }
}
