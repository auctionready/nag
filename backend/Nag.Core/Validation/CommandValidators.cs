using FluentValidation;
using Nag.Core.Commands;
using Nag.Core.Domain;

namespace Nag.Core.Validation;

public sealed class CreateHabitValidator : AbstractValidator<CreateHabit>
{
    public CreateHabitValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Goal!)
            .SetValidator(new GoalPayloadValidator())
            .When(x => x.Goal is not null);
    }
}

public sealed class UpdateHabitValidator : AbstractValidator<UpdateHabit>
{
    public UpdateHabitValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().When(x => x.Title is not null);
        RuleFor(x => x.Goal!)
            .SetValidator(new GoalPayloadValidator())
            .When(x => x.Goal is not null && !x.ClearGoal);
    }
}

public sealed class DeleteHabitValidator : AbstractValidator<DeleteHabit>
{
    public DeleteHabitValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class CreateCheckInValidator : AbstractValidator<CreateCheckIn>
{
    public CreateCheckInValidator(TimeProvider clock)
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
        // Period invariant: a new check-in must fall in the current week.
        // Combined with UpdateCheckIn's matching rule, this means a check-in's
        // week never changes after creation, so the per-week summary
        // projections never observe a cross-period move.
        RuleFor(x => x.Timestamp)
            .Must(ts => PeriodCalculator.IsInCurrentPeriod(Regularity.Week, ts, clock.GetUtcNow()))
            .WithMessage("Check-in timestamp must fall within the current week.");
    }
}

public sealed class UpdateCheckInValidator : AbstractValidator<UpdateCheckIn>
{
    public UpdateCheckInValidator(TimeProvider clock)
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.Timestamp)
            .Must(ts => PeriodCalculator.IsInCurrentPeriod(Regularity.Week, ts, clock.GetUtcNow()))
            .WithMessage("Check-in timestamp must fall within the current week.");
    }
}

public sealed class DeleteCheckInValidator : AbstractValidator<DeleteCheckIn>
{
    public DeleteCheckInValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
    }
}

public sealed class GoalPayloadValidator : AbstractValidator<GoalPayload>
{
    public GoalPayloadValidator()
    {
        RuleFor(x => x.Regularity).IsInEnum();

        RuleFor(x => x)
            .Must(g => (g.Frequency.HasValue) ^ (g.Schedules is not null && g.Schedules.Count > 0))
            .WithMessage("Goal must specify exactly one of frequency or schedules.");

        RuleFor(x => x.Frequency!.Value).GreaterThan(0).When(x => x.Frequency.HasValue);

        RuleForEach(x => x.Schedules!)
            .SetValidator((parent, _) => new ScheduleEntryValidator(parent.Regularity))
            .When(x => x.Schedules is not null);
    }
}

public sealed class ScheduleEntryValidator : AbstractValidator<ScheduleEntry>
{
    public ScheduleEntryValidator(Regularity regularity)
    {
        RuleFor(x => x.Hour).InclusiveBetween(0, 23);
        RuleFor(x => x.Minute).InclusiveBetween(0, 59);

        switch (regularity)
        {
            case Regularity.Day:
                RuleFor(x => x.Days).Null();
                RuleFor(x => x.DayOfMonth).Null();
                break;
            case Regularity.Week:
                RuleFor(x => x.Days!.Value).InclusiveBetween(0, 127).When(x => x.Days.HasValue);
                RuleFor(x => x.DayOfMonth).Null();
                break;
            case Regularity.Month:
                RuleFor(x => x.Days).Null();
                RuleFor(x => x.DayOfMonth!.Value)
                    .InclusiveBetween(1, 31)
                    .When(x => x.DayOfMonth.HasValue);
                break;
        }
    }
}
