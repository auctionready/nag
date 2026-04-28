using System.Text.Json;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Core.Events;
using Shouldly;
using Xunit;

namespace Nag.Tests.Core.Contracts;

public class EventRegistryTests
{
    private readonly JsonSerializerOptions _opts = NagJsonOptions.Default;

    [Fact]
    public void registers_every_past_tense_event_type()
    {
        EventRegistry.ByName.Keys.ShouldBe(
            [
                "HabitCreated",
                "HabitDetailsEdited",
                "HabitGoalDefined",
                "HabitGoalCleared",
                "HabitDeleted",
                "CheckInRecorded",
                "CheckInMoved",
                "CheckInMarkedSkipped",
                "CheckInMarkedDone",
                "CheckInDeleted",
            ],
            ignoreOrder: true
        );
    }

    [Fact]
    public void TryDeserialize_round_trips_HabitCreated()
    {
        var original = new HabitCreated(
            Guid.NewGuid(),
            "Read",
            Description: "Daily reading",
            Goal: new GoalPayload(Regularity.Day, Frequency: 1)
        );
        var json = JsonSerializer.Serialize(original, _opts);
        var element = JsonSerializer.Deserialize<JsonElement>(json, _opts);

        EventRegistry
            .TryDeserialize(nameof(HabitCreated), element, _opts, out var roundtripped)
            .ShouldBeTrue();
        roundtripped.ShouldBeOfType<HabitCreated>().ShouldBe(original);
    }

    [Fact]
    public void TryDeserialize_round_trips_CheckInMoved_with_both_timestamps()
    {
        var original = new CheckInMoved(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateTimeOffset(2026, 4, 20, 8, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 4, 22, 18, 30, 0, TimeSpan.Zero)
        );
        var json = JsonSerializer.Serialize(original, _opts);
        var element = JsonSerializer.Deserialize<JsonElement>(json, _opts);

        EventRegistry
            .TryDeserialize(nameof(CheckInMoved), element, _opts, out var roundtripped)
            .ShouldBeTrue();
        var moved = roundtripped.ShouldBeOfType<CheckInMoved>();
        moved.OldTimestamp.ShouldBe(original.OldTimestamp);
        moved.NewTimestamp.ShouldBe(original.NewTimestamp);
    }

    [Fact]
    public void TryDeserialize_returns_false_for_unknown_type()
    {
        var element = JsonSerializer.Deserialize<JsonElement>("{}", _opts);
        EventRegistry.TryDeserialize("NoSuchEvent", element, _opts, out var output).ShouldBeFalse();
        output.ShouldBeNull();
    }
}
