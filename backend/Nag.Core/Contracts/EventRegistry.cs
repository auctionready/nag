using System.Text.Json;
using Nag.Core.Events;

namespace Nag.Core.Contracts;

/// <summary>
/// Past-tense event vocabulary. These are the immutable facts the server
/// appends to the Marten event store and ships to clients on
/// <c>/sync</c>. Keep parallel with the TS event types in
/// <c>packages/core/src/events/</c>.
///
/// <para>
/// <see cref="CommandRegistry"/> stays for the inbound write API
/// (commands are the client-side intent representation); events are
/// emitted by the server's command handlers as a fact of what happened.
/// </para>
/// </summary>
public static class EventRegistry
{
    public static readonly IReadOnlyDictionary<string, Type> ByName = new Dictionary<string, Type>
    {
        [nameof(HabitCreated)] = typeof(HabitCreated),
        [nameof(HabitDetailsEdited)] = typeof(HabitDetailsEdited),
        [nameof(HabitGoalDefined)] = typeof(HabitGoalDefined),
        [nameof(HabitGoalCleared)] = typeof(HabitGoalCleared),
        [nameof(HabitDeleted)] = typeof(HabitDeleted),
        [nameof(CheckInRecorded)] = typeof(CheckInRecorded),
        [nameof(CheckInMoved)] = typeof(CheckInMoved),
        [nameof(CheckInMarkedSkipped)] = typeof(CheckInMarkedSkipped),
        [nameof(CheckInMarkedDone)] = typeof(CheckInMarkedDone),
        [nameof(CheckInDeleted)] = typeof(CheckInDeleted),
    };

    public static IReadOnlyList<Type> All => ByName.Values.ToList();

    public static bool TryDeserialize(
        string type,
        JsonElement payload,
        JsonSerializerOptions options,
        out object? @event
    )
    {
        if (!ByName.TryGetValue(type, out var clrType))
        {
            @event = null;
            return false;
        }
        @event = payload.Deserialize(clrType, options);
        return @event is not null;
    }
}
