using FluentValidation;
using Marten;
using Nag.Core.Commands;
using Nag.Core.Events;
using Nag.Core.Idempotency;
using Nag.Core.ReadModels;

namespace Nag.Core.Handlers;

/// <summary>
/// Translates an inbound (intent-shaped) command into one or more
/// past-tense (fact-shaped) events and appends them to the event store.
/// Validation runs before any state read; idempotency is keyed on the
/// envelope id; per-check-in state is loaded from
/// <see cref="CheckInState"/> so move / delete events can carry the
/// current timestamp.
/// </summary>
public sealed class CommandDispatcher(
    IDocumentSession session,
    IServiceProvider services,
    TimeProvider clock
)
{
    public async Task<DispatchResult> DispatchAsync(
        Guid envelopeId,
        object command,
        CancellationToken ct
    )
    {
        var validatorType = typeof(IValidator<>).MakeGenericType(command.GetType());
        if (services.GetService(validatorType) is IValidator validator)
        {
            var ctx = new ValidationContext<object>(command);
            var result = await validator.ValidateAsync(ctx, ct);
            if (!result.IsValid)
            {
                var messages = result.Errors.Select(e => e.ErrorMessage).ToList();
                return DispatchResult.Invalid(messages);
            }
        }

        var existing = await session.LoadAsync<ProcessedCommand>(envelopeId, ct);
        if (existing is not null)
        {
            return DispatchResult.Duplicate(existing.Sequence);
        }

        var translation = await TranslateAsync(command, ct);
        if (translation.Errors is { Count: > 0 })
        {
            return DispatchResult.Invalid(translation.Errors);
        }
        if (translation.Events.Count == 0)
        {
            // Nothing to record (e.g. UpdateHabit with no fields). Treat as
            // accepted-but-no-op; reserve the envelope id so retries dedupe.
            session.Store(new ProcessedCommand(envelopeId, 0, clock.GetUtcNow()));
            await session.SaveChangesAsync(ct);
            return DispatchResult.Accepted(0);
        }

        var stream = session.Events.Append(NagStreams.Root, translation.Events.ToArray());
        await session.SaveChangesAsync(ct);

        var sequence = stream.Events[^1].Sequence;
        session.Store(new ProcessedCommand(envelopeId, sequence, clock.GetUtcNow()));
        await session.SaveChangesAsync(ct);

        return DispatchResult.Accepted(sequence);
    }

    private async Task<Translation> TranslateAsync(object command, CancellationToken ct)
    {
        switch (command)
        {
            case CreateHabit create:
                return Translation.Of(
                    new HabitCreated(
                        create.HabitId,
                        create.Title,
                        create.Description,
                        create.Icon,
                        create.Goal
                    )
                );

            case UpdateHabit update:
                return TranslateUpdateHabit(update);

            case DeleteHabit delete:
                return Translation.Of(new HabitDeleted(delete.HabitId));

            case CreateCheckIn create:
                return Translation.Of(
                    new CheckInRecorded(
                        create.CheckInId,
                        create.HabitId,
                        create.Timestamp,
                        create.Skipped ?? false
                    )
                );

            case UpdateCheckIn update:
                return await TranslateUpdateCheckInAsync(update, ct);

            case DeleteCheckIn delete:
                return await TranslateDeleteCheckInAsync(delete, ct);

            default:
                throw new InvalidOperationException(
                    $"CommandDispatcher: no event translation for {command.GetType().Name}"
                );
        }
    }

    private static Translation TranslateUpdateHabit(UpdateHabit update)
    {
        var events = new List<object>();

        var detailsTouched =
            update.Title is not null
            || update.Description is not null
            || update.ClearDescription
            || update.Icon is not null
            || update.ClearIcon;
        if (detailsTouched)
        {
            events.Add(
                new HabitDetailsEdited(
                    update.HabitId,
                    update.Title,
                    update.Description,
                    update.ClearDescription,
                    update.Icon,
                    update.ClearIcon
                )
            );
        }

        if (update.ClearGoal)
        {
            events.Add(new HabitGoalCleared(update.HabitId));
        }
        else if (update.Goal is not null)
        {
            events.Add(
                new HabitGoalDefined(
                    update.HabitId,
                    update.Goal.Regularity,
                    update.Goal.Frequency,
                    update.Goal.Schedules
                )
            );
        }

        return new Translation(events, null);
    }

    private async Task<Translation> TranslateUpdateCheckInAsync(
        UpdateCheckIn update,
        CancellationToken ct
    )
    {
        var state = await session.LoadAsync<CheckInState>(update.CheckInId, ct);
        if (state is null || state.Deleted)
        {
            return Translation.Invalid($"check-in {update.CheckInId} does not exist");
        }

        var events = new List<object>();
        if (update.Timestamp != state.Timestamp)
        {
            events.Add(
                new CheckInMoved(update.CheckInId, state.HabitId, state.Timestamp, update.Timestamp)
            );
        }
        if (update.Skipped is { } newSkipped)
        {
            // The post-move timestamp is what subsequent slicers should
            // route on; emit skip events with the most recent timestamp.
            var skipTimestamp = update.Timestamp;
            if (newSkipped && !state.Skipped)
            {
                events.Add(
                    new CheckInMarkedSkipped(update.CheckInId, state.HabitId, skipTimestamp)
                );
            }
            else if (!newSkipped && state.Skipped)
            {
                events.Add(new CheckInMarkedDone(update.CheckInId, state.HabitId, skipTimestamp));
            }
        }
        return new Translation(events, null);
    }

    private async Task<Translation> TranslateDeleteCheckInAsync(
        DeleteCheckIn delete,
        CancellationToken ct
    )
    {
        var state = await session.LoadAsync<CheckInState>(delete.CheckInId, ct);
        if (state is null || state.Deleted)
        {
            return Translation.Invalid($"check-in {delete.CheckInId} does not exist");
        }
        return Translation.Of(new CheckInDeleted(delete.CheckInId, state.HabitId, state.Timestamp));
    }

    private sealed record Translation(IReadOnlyList<object> Events, IReadOnlyList<string>? Errors)
    {
        public static Translation Of(params object[] events) => new(events, null);

        public static Translation Invalid(string error) => new([], [error]);
    }
}

public sealed record DispatchResult(
    DispatchOutcome Outcome,
    long Sequence,
    IReadOnlyList<string> Errors
)
{
    public static DispatchResult Accepted(long sequence) =>
        new(DispatchOutcome.Accepted, sequence, []);

    public static DispatchResult Duplicate(long sequence) =>
        new(DispatchOutcome.Duplicate, sequence, []);

    public static DispatchResult Invalid(IReadOnlyList<string> errors) =>
        new(DispatchOutcome.Invalid, 0, errors);
}

public enum DispatchOutcome
{
    Accepted,
    Duplicate,
    Invalid,
}
