using System.Text.Json;
using Nag.Core.Commands;

namespace Nag.Core.Contracts;

public static class CommandRegistry
{
    public static readonly IReadOnlyDictionary<string, Type> ByName = new Dictionary<string, Type>
    {
        [nameof(CreateHabit)] = typeof(CreateHabit),
        [nameof(UpdateHabit)] = typeof(UpdateHabit),
        [nameof(DeleteHabit)] = typeof(DeleteHabit),
        [nameof(CreateCheckIn)] = typeof(CreateCheckIn),
        [nameof(UpdateCheckIn)] = typeof(UpdateCheckIn),
        [nameof(DeleteCheckIn)] = typeof(DeleteCheckIn),
    };

    public static IReadOnlyList<Type> All => ByName.Values.ToList();

    public static bool TryDeserialize(
        string type,
        JsonElement payload,
        JsonSerializerOptions options,
        out object? command
    )
    {
        if (!ByName.TryGetValue(type, out var clrType))
        {
            command = null;
            return false;
        }
        command = payload.Deserialize(clrType, options);
        return command is not null;
    }
}
