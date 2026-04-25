using System.Net.Http.Json;
using Nag.Core.Contracts;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class HomeBoardEndpointsTests : IClassFixture<HomeBoardEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public HomeBoardEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_homeboard";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient() => _factory.CreateAuthedClient();

    [Fact]
    public async Task posted_habit_appears_on_board()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid();

        var envelope = new
        {
            id = Guid.NewGuid(),
            type = "CreateHabit",
            timestamp = DateTimeOffset.UtcNow,
            payload = new
            {
                habitId,
                title = "Read",
                goal = new { regularity = "day", frequency = 1 },
            },
        };
        var resp = await client.PostAsJsonAsync("/commands", envelope);
        resp.EnsureSuccessStatusCode();

        var board = await client.GetFromJsonAsync<HomeBoard>("/home-board", NagJsonOptions.Default);
        board.ShouldNotBeNull();
        board!.Habits.ShouldContain(h => h.Id == habitId && h.Title == "Read");
    }

    [Fact]
    public async Task check_in_appears_in_period()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid();
        var checkInId = Guid.NewGuid();

        await client.PostAsJsonAsync(
            "/commands",
            new
            {
                id = Guid.NewGuid(),
                type = "CreateHabit",
                timestamp = DateTimeOffset.UtcNow,
                payload = new
                {
                    habitId,
                    title = "Read",
                    goal = new { regularity = "day", frequency = 1 },
                },
            }
        );
        await client.PostAsJsonAsync(
            "/commands",
            new
            {
                id = Guid.NewGuid(),
                type = "CreateCheckIn",
                timestamp = DateTimeOffset.UtcNow,
                payload = new
                {
                    checkInId,
                    habitId,
                    timestamp = DateTimeOffset.UtcNow,
                },
            }
        );

        var board = await client.GetFromJsonAsync<HomeBoard>("/home-board", NagJsonOptions.Default);
        var habit = board!.Habits.Single(h => h.Id == habitId);
        habit.PeriodCheckIns.ShouldContain(c => c.Id == checkInId);
    }
}
