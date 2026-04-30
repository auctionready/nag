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

/// <summary>
/// Body of <c>POST /events</c> (201/200) and
/// <c>GET /events/by-envelope/{id}</c>. Returns the events the server
/// appended for one previously-POSTed envelope, in stream order. Lets
/// the client reconcile against what the server actually persisted
/// without rewalking the whole stream via <c>/sync</c>.
///
/// Uses C# 11 <c>required</c> properties (rather than positional
/// record params) so Swashbuckle emits <c>required: ["id", "events"]</c>
/// in the OpenAPI doc; the generated Zod schema is then strict
/// (non-<c>.partial()</c>) and the client can call the typed
/// <c>postEvents</c> without a cast or <c>?? []</c> dance on every use.
/// </summary>
public sealed record EventsByEnvelope
{
    public required Guid Id { get; init; }
    public required IReadOnlyList<EventEnvelope> Events { get; init; }
}

/// <summary>
/// Outbound read envelope on <c>POST /events</c> (in the
/// <see cref="EventsByEnvelope"/> body), <c>GET /events</c>, and
/// <c>/sync</c> replays. <see cref="Type"/> is a member of
/// <see cref="EventRegistry"/>; <see cref="Payload"/> is the
/// event-specific JSON the client deserialises and applies to local
/// state via <c>applyServerEvent</c>.
///
/// Same <c>required</c> rationale as <see cref="EventsByEnvelope"/>.
/// </summary>
public sealed record EventEnvelope
{
    public required long Sequence { get; init; }
    public required Guid Id { get; init; }
    public required string Type { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
    public required JsonElement Payload { get; init; }
}

public sealed record EventsPage(IReadOnlyList<EventEnvelope> Events, long? NextSince);

public sealed record ErrorResponse(IReadOnlyList<string> Errors);
