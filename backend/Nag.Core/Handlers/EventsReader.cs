using System.Text.Json;
using Marten;
using Nag.Core.Contracts;

namespace Nag.Core.Handlers;

/// <summary>
/// Reads past-tense events from the Marten event store and shapes them
/// into the wire-format <see cref="EventEnvelope"/> the client consumes
/// on <c>GET /events</c> and <c>/sync</c> replays.
/// </summary>
public sealed class EventsReader(IQuerySession session, JsonSerializerOptions jsonOptions)
{
    private const int MaxLimit = 500;

    public async Task<EventsPage> ReadSinceAsync(long since, int? limit, CancellationToken ct)
    {
        var take = Math.Clamp(limit ?? MaxLimit, 1, MaxLimit);

        var events = await session
            .Events.QueryAllRawEvents()
            .Where(e => e.Sequence > since)
            .OrderBy(e => e.Sequence)
            .Take(take)
            .ToListAsync(ct);

        var envelopes = events
            .Select(e => new EventEnvelope
            {
                Sequence = e.Sequence,
                Id = e.Id,
                Type =
                    EventRegistry.ByName.FirstOrDefault(kv => kv.Value == e.Data!.GetType()).Key
                    ?? e.EventTypeName,
                Timestamp = new DateTimeOffset(e.Timestamp.UtcDateTime, TimeSpan.Zero),
                Payload = JsonSerializer.SerializeToElement(e.Data, jsonOptions),
            })
            .ToList();

        long? nextSince = envelopes.Count == take ? envelopes[^1].Sequence : null;
        return new EventsPage(envelopes, nextSince);
    }
}
