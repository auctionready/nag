using System.Text.Json;
using Marten;
using Nag.Core.Contracts;

namespace Nag.Core.Handlers;

public sealed class CommandsReader(IQuerySession session, JsonSerializerOptions jsonOptions)
{
    private const int MaxLimit = 500;

    public async Task<CommandsPage> ReadSinceAsync(long since, int? limit, CancellationToken ct)
    {
        var take = Math.Clamp(limit ?? MaxLimit, 1, MaxLimit);

        var events = await session
            .Events.QueryAllRawEvents()
            .Where(e => e.Sequence > since)
            .OrderBy(e => e.Sequence)
            .Take(take)
            .ToListAsync(ct);

        var commands = events
            .Select(e => new CommandEnvelopeOut(
                e.Sequence,
                e.Id,
                CommandRegistry.ByName.FirstOrDefault(kv => kv.Value == e.Data!.GetType()).Key
                    ?? e.EventTypeName,
                new DateTimeOffset(e.Timestamp.UtcDateTime, TimeSpan.Zero),
                JsonSerializer.SerializeToElement(e.Data, jsonOptions)
            ))
            .ToList();

        long? nextSince = commands.Count == take ? commands[^1].Sequence : null;
        return new CommandsPage(commands, nextSince);
    }
}
