using System.Text.Json;

namespace Nag.Core.Contracts;

/// <summary>
/// Inbound write envelope on <c>POST /events</c>. The client emits one
/// envelope per user intent ("the user updated this habit"), carrying
/// the one-or-more past-tense events that intent produced. Server
/// dedupes on <see cref="Id"/> and appends the events atomically.
///
/// Each <see cref="EventEntry.Type"/> must name a member of
/// <see cref="EventRegistry"/>; <see cref="EventEntry.Payload"/> is
/// the event-specific JSON.
/// </summary>
public sealed record WriteEventEnvelope(
    Guid Id,
    DateTimeOffset Timestamp,
    IReadOnlyList<EventEntry> Events
);

public sealed record EventEntry(string Type, JsonElement Payload);

public sealed record WriteEventAccepted(bool Accepted, long Sequence);

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
