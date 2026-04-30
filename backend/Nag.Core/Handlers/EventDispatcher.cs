using FluentValidation;
using Marten;
using Nag.Core.Idempotency;

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
