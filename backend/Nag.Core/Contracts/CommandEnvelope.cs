using System.Text.Json;

namespace Nag.Core.Contracts;

/// <summary>
/// Inbound write envelope on <c>POST /commands</c>. <see cref="Type"/> is
/// a member of <see cref="CommandRegistry"/>; <see cref="Payload"/> is the
/// command-specific JSON the server deserialises into a command type and
/// hands to <see cref="Handlers.CommandDispatcher"/>.
/// </summary>
public sealed record CommandEnvelope(
    Guid Id,
    string Type,
    DateTimeOffset Timestamp,
    JsonElement Payload
);

public sealed record CommandAccepted(bool Accepted, long Sequence);

/// <summary>
/// Outbound read envelope on <c>GET /events</c> and <c>/sync</c> replays.
/// <see cref="Type"/> is a member of <see cref="EventRegistry"/>;
/// <see cref="Payload"/> is the event-specific JSON the client
/// deserialises and applies to local state via <c>applyServerEvent</c>.
/// </summary>
public sealed record EventEnvelope(
    long Sequence,
    Guid Id,
    string Type,
    DateTimeOffset Timestamp,
    JsonElement Payload
);

public sealed record EventsPage(IReadOnlyList<EventEnvelope> Events, long? NextSince);

public sealed record ErrorResponse(IReadOnlyList<string> Errors);
