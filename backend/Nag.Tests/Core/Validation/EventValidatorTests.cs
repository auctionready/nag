using FluentValidation.TestHelper;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.Validation;
using Xunit;

namespace Nag.Tests.Core.Validation;

public class HabitCreatedValidatorTests
{
    private readonly HabitCreatedValidator _v = new();

    [Fact]
    public void valid_event_passes()
    {
        var e = new HabitCreated(Guid.NewGuid(), "Read");
        _v.TestValidate(e).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void empty_title_fails()
    {
        var e = new HabitCreated(Guid.NewGuid(), "");
        _v.TestValidate(e).ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void empty_habit_id_fails()
    {
        var e = new HabitCreated(Guid.Empty, "Read");
        _v.TestValidate(e).ShouldHaveValidationErrorFor(x => x.HabitId);
    }

    [Fact]
    public void goal_with_frequency_passes()
    {
        var e = new HabitCreated(
            Guid.NewGuid(),
            "Read",
            Goal: new GoalPayload(Regularity.Day, Frequency: 1)
        );
        _v.TestValidate(e).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void goal_with_both_frequency_and_schedules_fails()
    {
        var e = new HabitCreated(
            Guid.NewGuid(),
            "Read",
            Goal: new GoalPayload(
                Regularity.Day,
                Frequency: 1,
                Schedules: [new ScheduleEntry(8, 0)]
            )
        );
        _v.TestValidate(e).ShouldHaveValidationErrorFor("Goal");
    }

    [Fact]
    public void goal_with_neither_frequency_nor_schedules_fails()
    {
        var e = new HabitCreated(Guid.NewGuid(), "Read", Goal: new GoalPayload(Regularity.Day));
        _v.TestValidate(e).ShouldHaveValidationErrorFor("Goal");
    }
}

public class HabitGoalDefinedValidatorTests
{
    private readonly HabitGoalDefinedValidator _v = new();

    [Fact]
    public void weekly_schedule_with_dayOfMonth_fails()
    {
        var e = new HabitGoalDefined(
            Guid.NewGuid(),
            Regularity.Week,
            Schedules: [new ScheduleEntry(8, 0, Days: 0b0111110, DayOfMonth: 15)]
        );
        var result = _v.TestValidate(e);
        result.ShouldHaveValidationErrorFor("Schedules[0].DayOfMonth");
    }

    [Fact]
    public void monthly_schedule_with_days_bitmask_fails()
    {
        var e = new HabitGoalDefined(
            Guid.NewGuid(),
            Regularity.Month,
            Schedules: [new ScheduleEntry(8, 0, Days: 0b0111110)]
        );
        var result = _v.TestValidate(e);
        result.ShouldHaveValidationErrorFor("Schedules[0].Days");
    }

    [Fact]
    public void hour_24_fails()
    {
        var e = new HabitGoalDefined(
            Guid.NewGuid(),
            Regularity.Day,
            Schedules: [new ScheduleEntry(24, 0)]
        );
        _v.TestValidate(e).ShouldHaveValidationErrorFor("Schedules[0].Hour");
    }

    [Fact]
    public void days_above_127_fails()
    {
        var e = new HabitGoalDefined(
            Guid.NewGuid(),
            Regularity.Week,
            Schedules: [new ScheduleEntry(8, 0, Days: 200)]
        );
        _v.TestValidate(e).ShouldHaveValidationErrorFor("Schedules[0].Days.Value");
    }

    [Fact]
    public void monthly_dayOfMonth_in_range_passes()
    {
        var e = new HabitGoalDefined(
            Guid.NewGuid(),
            Regularity.Month,
            Schedules: [new ScheduleEntry(8, 0, DayOfMonth: 15)]
        );
        _v.TestValidate(e).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void neither_frequency_nor_schedules_fails()
    {
        var e = new HabitGoalDefined(Guid.NewGuid(), Regularity.Day);
        _v.TestValidate(e).ShouldHaveValidationErrors();
    }
}

public class CheckInMovedValidatorTests
{
    private readonly CheckInMovedValidator _v = new();

    [Fact]
    public void distinct_old_and_new_passes()
    {
        var e = new CheckInMoved(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateTimeOffset(2026, 4, 20, 8, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 4, 20, 9, 0, 0, TimeSpan.Zero)
        );
        _v.TestValidate(e).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void same_old_and_new_fails()
    {
        var ts = new DateTimeOffset(2026, 4, 20, 8, 0, 0, TimeSpan.Zero);
        var e = new CheckInMoved(Guid.NewGuid(), Guid.NewGuid(), ts, ts);
        _v.TestValidate(e).ShouldHaveValidationErrors();
    }
}
