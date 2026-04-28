using FluentValidation.TestHelper;
using Nag.Core.Commands;
using Nag.Core.Domain;
using Nag.Core.Validation;
using Xunit;

namespace Nag.Tests.Core.Validation;

public class CreateHabitValidatorTests
{
    private readonly CreateHabitValidator _v = new();

    [Fact]
    public void valid_create_passes()
    {
        var cmd = new CreateHabit(Guid.NewGuid(), "Read");
        _v.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void empty_title_fails()
    {
        var cmd = new CreateHabit(Guid.NewGuid(), "");
        _v.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void empty_habit_id_fails()
    {
        var cmd = new CreateHabit(Guid.Empty, "Read");
        _v.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.HabitId);
    }

    [Fact]
    public void goal_with_frequency_passes()
    {
        var cmd = new CreateHabit(
            Guid.NewGuid(),
            "Read",
            Goal: new GoalPayload(Regularity.Day, Frequency: 1)
        );
        _v.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void goal_with_both_frequency_and_schedules_fails()
    {
        var cmd = new CreateHabit(
            Guid.NewGuid(),
            "Read",
            Goal: new GoalPayload(
                Regularity.Day,
                Frequency: 1,
                Schedules: [new ScheduleEntry(8, 0)]
            )
        );
        _v.TestValidate(cmd).ShouldHaveValidationErrorFor("Goal");
    }

    [Fact]
    public void goal_with_neither_frequency_nor_schedules_fails()
    {
        var cmd = new CreateHabit(Guid.NewGuid(), "Read", Goal: new GoalPayload(Regularity.Day));
        _v.TestValidate(cmd).ShouldHaveValidationErrorFor("Goal");
    }
}

public class GoalPayloadValidatorTests
{
    private readonly GoalPayloadValidator _v = new();

    [Fact]
    public void weekly_schedule_with_dayOfMonth_fails()
    {
        var goal = new GoalPayload(
            Regularity.Week,
            Schedules: [new ScheduleEntry(8, 0, Days: 0b0111110, DayOfMonth: 15)]
        );
        var result = _v.TestValidate(goal);
        result.ShouldHaveValidationErrorFor("Schedules[0].DayOfMonth");
    }

    [Fact]
    public void monthly_schedule_with_days_bitmask_fails()
    {
        var goal = new GoalPayload(
            Regularity.Month,
            Schedules: [new ScheduleEntry(8, 0, Days: 0b0111110)]
        );
        var result = _v.TestValidate(goal);
        result.ShouldHaveValidationErrorFor("Schedules[0].Days");
    }

    [Fact]
    public void hour_24_fails()
    {
        var goal = new GoalPayload(Regularity.Day, Schedules: [new ScheduleEntry(24, 0)]);
        _v.TestValidate(goal).ShouldHaveValidationErrorFor("Schedules[0].Hour");
    }

    [Fact]
    public void days_above_127_fails()
    {
        var goal = new GoalPayload(
            Regularity.Week,
            Schedules: [new ScheduleEntry(8, 0, Days: 200)]
        );
        _v.TestValidate(goal).ShouldHaveValidationErrorFor("Schedules[0].Days.Value");
    }

    [Fact]
    public void monthly_dayOfMonth_in_range_passes()
    {
        var goal = new GoalPayload(
            Regularity.Month,
            Schedules: [new ScheduleEntry(8, 0, DayOfMonth: 15)]
        );
        _v.TestValidate(goal).ShouldNotHaveAnyValidationErrors();
    }
}

public class CheckInPeriodInvariantTests
{
    // Fixed "now" is a Wednesday (2026-04-29) so the current week runs
    // Sunday 2026-04-26 through Saturday 2026-05-02 (UTC).
    private static readonly DateTimeOffset _now = new(2026, 4, 29, 12, 0, 0, TimeSpan.Zero);

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private readonly CreateCheckInValidator _create = new(new FixedClock(_now));
    private readonly UpdateCheckInValidator _update = new(new FixedClock(_now));

    [Fact]
    public void create_passes_when_timestamp_is_in_current_week()
    {
        var cmd = new CreateCheckIn(Guid.NewGuid(), Guid.NewGuid(), _now.AddDays(-1));
        _create.TestValidate(cmd).ShouldNotHaveValidationErrorFor(c => c.Timestamp);
    }

    [Fact]
    public void create_fails_when_timestamp_is_in_previous_week()
    {
        var lastWeek = new DateTimeOffset(2026, 4, 25, 12, 0, 0, TimeSpan.Zero); // Saturday
        var cmd = new CreateCheckIn(Guid.NewGuid(), Guid.NewGuid(), lastWeek);
        _create.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.Timestamp);
    }

    [Fact]
    public void create_fails_when_timestamp_is_in_next_week()
    {
        var nextWeek = new DateTimeOffset(2026, 5, 3, 0, 0, 0, TimeSpan.Zero); // Sunday after
        var cmd = new CreateCheckIn(Guid.NewGuid(), Guid.NewGuid(), nextWeek);
        _create.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.Timestamp);
    }

    [Fact]
    public void update_passes_when_timestamp_is_in_current_week()
    {
        var cmd = new UpdateCheckIn(Guid.NewGuid(), _now.AddHours(-3));
        _update.TestValidate(cmd).ShouldNotHaveValidationErrorFor(c => c.Timestamp);
    }

    [Fact]
    public void update_fails_when_timestamp_is_in_previous_week()
    {
        var lastWeek = new DateTimeOffset(2026, 4, 22, 0, 0, 0, TimeSpan.Zero);
        var cmd = new UpdateCheckIn(Guid.NewGuid(), lastWeek);
        _update.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.Timestamp);
    }
}
