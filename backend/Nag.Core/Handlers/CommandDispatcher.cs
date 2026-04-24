using FluentValidation;
using Marten;
using Nag.Core.Contracts;
using Nag.Core.Idempotency;

namespace Nag.Core.Handlers;

public sealed class CommandDispatcher
{
    private readonly IDocumentSession _session;
    private readonly IServiceProvider _services;
    private readonly TimeProvider _clock;

    public CommandDispatcher(
        IDocumentSession session,
        IServiceProvider services,
        TimeProvider clock
    )
    {
        _session = session;
        _services = services;
        _clock = clock;
    }

    public async Task<DispatchResult> DispatchAsync(
        Guid envelopeId,
        object command,
        CancellationToken ct
    )
    {
        var validatorType = typeof(IValidator<>).MakeGenericType(command.GetType());
        if (_services.GetService(validatorType) is IValidator validator)
        {
            var ctx = new ValidationContext<object>(command);
            var result = await validator.ValidateAsync(ctx, ct);
            if (!result.IsValid)
            {
                var messages = result.Errors.Select(e => e.ErrorMessage).ToList();
                return DispatchResult.Invalid(messages);
            }
        }

        var existing = await _session.LoadAsync<ProcessedCommand>(envelopeId, ct);
        if (existing is not null)
        {
            return DispatchResult.Duplicate(existing.Sequence);
        }

        var stream = _session.Events.Append(NagStreams.Root, command);
        await _session.SaveChangesAsync(ct);

        var sequence = stream.Events.Last().Sequence;
        _session.Store(new ProcessedCommand(envelopeId, sequence, _clock.GetUtcNow()));
        await _session.SaveChangesAsync(ct);

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
        new(DispatchOutcome.Accepted, sequence, Array.Empty<string>());

    public static DispatchResult Duplicate(long sequence) =>
        new(DispatchOutcome.Duplicate, sequence, Array.Empty<string>());

    public static DispatchResult Invalid(IReadOnlyList<string> errors) =>
        new(DispatchOutcome.Invalid, 0, errors);
}

public enum DispatchOutcome
{
    Accepted,
    Duplicate,
    Invalid,
}
