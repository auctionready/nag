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
