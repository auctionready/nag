using System.Text.Json;

namespace Nag.Core.Contracts;

public sealed record CommandEnvelope(
    Guid Id,
    string Type,
    DateTimeOffset Timestamp,
    JsonElement Payload
);

public sealed record CommandAccepted(bool Accepted, long Sequence);

public sealed record CommandsPage(IReadOnlyList<CommandEnvelopeOut> Commands, long? NextSince);

public sealed record CommandEnvelopeOut(
    long Sequence,
    Guid Id,
    string Type,
    DateTimeOffset Timestamp,
    JsonElement Payload
);
