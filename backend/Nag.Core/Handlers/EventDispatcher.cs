using FluentValidation;
using Marten;
using Nag.Core.Events;
using Nag.Core.Idempotency;
using Nag.Core.ReadModels;

namespace Nag.Core.Handlers;

/// <summary>
/// Appends one or more past-tense events to the event store, atomically
/// per envelope. The client is the source of truth for command → event
/// translation (it has the local DB state needed to fill in
/// <c>OldTimestamp</c> on <c>CheckInMoved</c> and so on); the server's
/// job here is just validation, idempotency, and the durable append.
///
/// Empty envelopes (<c>events.Count == 0</c>) reserve the envelope id
/// and return <c>Accepted</c> with both sequence bounds at <c>0</c> —
/// keeps the client retry path idempotent for no-op intents.
/// </summary>
public sealed class EventDispatcher(
    IDocumentSession session,
    IServiceProvider services,
    TimeProvider clock
)
{
    public async Task<DispatchResult> DispatchAsync(
        Guid envelopeId,
        IReadOnlyList<object> events,
        CancellationToken ct
    )
    {
        foreach (var @event in events)
        {
            var validatorType = typeof(IValidator<>).MakeGenericType(@event.GetType());
            if (services.GetService(validatorType) is IValidator validator)
            {
                var ctx = new ValidationContext<object>(@event);
                var result = await validator.ValidateAsync(ctx, ct);
                if (!result.IsValid)
                {
                    var messages = result.Errors.Select(e => e.ErrorMessage).ToList();
                    return DispatchResult.Invalid(messages);
                }
            }
        }

        var existing = await session.LoadAsync<ProcessedEnvelope>(envelopeId, ct);
        if (existing is not null)
        {
            return DispatchResult.Duplicate(existing.FirstSequence, existing.LastSequence);
        }

        // State-aware lifecycle invariants (archive/pause transitions). Runs
        // after the duplicate check so a retried envelope short-circuits as
        // Duplicate rather than tripping an invariant on already-applied
        // state. The HomeBoard projection is inline, so it reflects every
        // event committed so far.
        var lifecycleError = await CheckHabitLifecycleAsync(events, ct);
        if (lifecycleError is not null)
        {
            return DispatchResult.Invalid([lifecycleError]);
        }

        if (events.Count == 0)
        {
            session.Store(new ProcessedEnvelope(envelopeId, 0, 0, clock.GetUtcNow()));
            await session.SaveChangesAsync(ct);
            return DispatchResult.Accepted(0, 0);
        }

        var stream = session.Events.Append(NagStreams.Root, events.ToArray());
        await session.SaveChangesAsync(ct);

        var firstSequence = stream.Events[0].Sequence;
        var lastSequence = stream.Events[^1].Sequence;
        session.Store(
            new ProcessedEnvelope(envelopeId, firstSequence, lastSequence, clock.GetUtcNow())
        );
        await session.SaveChangesAsync(ct);

        return DispatchResult.Accepted(firstSequence, lastSequence);
    }

    /// <summary>
    /// Validates archive/pause transitions against the habit's current
    /// state (from the inline <see cref="HomeBoard"/> projection). Mirrors
    /// the client-side command-handler guards so an out-of-date or hostile
    /// client can't push an illegal transition (e.g. unarchiving an active
    /// habit). Returns an error message for the first invalid event, or
    /// <c>null</c> when every lifecycle event is a legal transition.
    /// </summary>
    private async Task<string?> CheckHabitLifecycleAsync(
        IReadOnlyList<object> events,
        CancellationToken ct
    )
    {
        var hasLifecycle = events.Any(e =>
            e is HabitArchived or HabitUnarchived or HabitPaused or HabitUnpaused
        );
        if (!hasLifecycle)
        {
            return null;
        }

        var board = await session.LoadAsync<HomeBoard>(NagStreams.Root, ct);

        foreach (var @event in events)
        {
            var habitId = @event switch
            {
                HabitArchived e => e.HabitId,
                HabitUnarchived e => e.HabitId,
                HabitPaused e => e.HabitId,
                HabitUnpaused e => e.HabitId,
                _ => (Guid?)null,
            };
            if (habitId is null)
            {
                continue;
            }

            var habit = board?.Habits.FirstOrDefault(h => h.Id == habitId.Value);
            if (habit is null)
            {
                return $"Habit {habitId} not found.";
            }

            var archived = habit.ArchivedAt is not null;
            var paused = habit.PausedAt is not null;

            var error = @event switch
            {
                HabitArchived when archived => "Habit is already archived.",
                HabitUnarchived when !archived => "Habit is not archived.",
                HabitPaused when archived => "Cannot pause an archived habit.",
                HabitPaused when paused => "Habit is already paused.",
                HabitUnpaused when archived => "Cannot unpause an archived habit.",
                HabitUnpaused when !paused => "Habit is not paused.",
                _ => null,
            };
            if (error is not null)
            {
                return error;
            }
        }

        return null;
    }
}

public sealed record DispatchResult(
    DispatchOutcome Outcome,
    long FirstSequence,
    long LastSequence,
    IReadOnlyList<string> Errors
)
{
    public static DispatchResult Accepted(long firstSequence, long lastSequence) =>
        new(DispatchOutcome.Accepted, firstSequence, lastSequence, []);

    public static DispatchResult Duplicate(long firstSequence, long lastSequence) =>
        new(DispatchOutcome.Duplicate, firstSequence, lastSequence, []);

    public static DispatchResult Invalid(IReadOnlyList<string> errors) =>
        new(DispatchOutcome.Invalid, 0, 0, errors);
}

public enum DispatchOutcome
{
    Accepted,
    Duplicate,
    Invalid,
}
