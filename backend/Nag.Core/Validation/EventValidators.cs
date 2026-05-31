using FluentValidation;
using Nag.Core.Domain;
using Nag.Core.Events;

namespace Nag.Core.Validation;

/// <summary>
/// FluentValidation rules applied to inbound past-tense events
/// (<see cref="EventDispatcher"/>) before they're appended to the
/// stream. The client is the primary author of these events; rules
/// here are the server's defence-in-depth — required ids, non-empty
/// titles, well-formed goal payloads.
/// </summary>
public sealed class HabitCreatedValidator : AbstractValidator<HabitCreated>
{
    public HabitCreatedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Goal!)
            .SetValidator(new GoalPayloadValidator())
            .When(x => x.Goal is not null);
    }
}

public sealed class HabitDetailsEditedValidator : AbstractValidator<HabitDetailsEdited>
{
    public HabitDetailsEditedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().When(x => x.Title is not null);
    }
}

public sealed class HabitGoalDefinedValidator : AbstractValidator<HabitGoalDefined>
{
    public HabitGoalDefinedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x.Regularity).IsInEnum();
        RuleFor(x => x)
            .Must(g => g.Frequency.HasValue ^ (g.Schedules is not null && g.Schedules.Count > 0))
            .WithMessage("HabitGoalDefined must specify exactly one of frequency or schedules.");
        RuleFor(x => x.Frequency!.Value).GreaterThan(0).When(x => x.Frequency.HasValue);
        RuleForEach(x => x.Schedules!)
            .SetValidator((parent, _) => new ScheduleEntryValidator(parent.Regularity))
            .When(x => x.Schedules is not null);
    }
}

public sealed class HabitGoalClearedValidator : AbstractValidator<HabitGoalCleared>
{
    public HabitGoalClearedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class HabitDeletedValidator : AbstractValidator<HabitDeleted>
{
    public HabitDeletedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class HabitArchivedValidator : AbstractValidator<HabitArchived>
{
    public HabitArchivedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class HabitUnarchivedValidator : AbstractValidator<HabitUnarchived>
{
    public HabitUnarchivedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class HabitPausedValidator : AbstractValidator<HabitPaused>
{
    public HabitPausedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class HabitUnpausedValidator : AbstractValidator<HabitUnpaused>
{
    public HabitUnpausedValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class CheckInRecordedValidator : AbstractValidator<CheckInRecorded>
{
    public CheckInRecordedValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class CheckInMovedValidator : AbstractValidator<CheckInMoved>
{
    public CheckInMovedValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
        RuleFor(x => x)
            .Must(e => e.OldTimestamp != e.NewTimestamp)
            .WithMessage("CheckInMoved.OldTimestamp must differ from NewTimestamp.");
    }
}

public sealed class CheckInMarkedSkippedValidator : AbstractValidator<CheckInMarkedSkipped>
{
    public CheckInMarkedSkippedValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class CheckInMarkedDoneValidator : AbstractValidator<CheckInMarkedDone>
{
    public CheckInMarkedDoneValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class CheckInDeletedValidator : AbstractValidator<CheckInDeleted>
{
    public CheckInDeletedValidator()
    {
        RuleFor(x => x.CheckInId).NotEmpty();
        RuleFor(x => x.HabitId).NotEmpty();
    }
}

public sealed class GoalPayloadValidator : AbstractValidator<GoalPayload>
{
    public GoalPayloadValidator()
    {
        RuleFor(x => x.Regularity).IsInEnum();
        RuleFor(x => x)
            .Must(g => g.Frequency.HasValue ^ (g.Schedules is not null && g.Schedules.Count > 0))
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
