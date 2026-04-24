using FluentValidation;
using Marten;
using Nag.Core.Idempotency;

namespace Nag.Core.Handlers;

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

        var stream = session.Events.Append(NagStreams.Root, command);
        await session.SaveChangesAsync(ct);

        var sequence = stream.Events[^1].Sequence;
        session.Store(new ProcessedCommand(envelopeId, sequence, clock.GetUtcNow()));
        await session.SaveChangesAsync(ct);

        return DispatchResult.Accepted(sequence);
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
