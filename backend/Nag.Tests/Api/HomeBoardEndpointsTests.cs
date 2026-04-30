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
            timestamp = DateTimeOffset.UtcNow,
            events = new[]
            {
                new
                {
                    type = "HabitCreated",
                    payload = new
                    {
                        habitId,
                        title = "Read",
                        goal = new { regularity = "day", frequency = 1 },
                    },
                },
            },
        };
        var resp = await client.PostAsJsonAsync("/events", envelope);
        resp.EnsureSuccessStatusCode();

        var board = await client.GetFromJsonAsync<HomeBoard>("/home-board", NagJsonOptions.Default);
        board.ShouldNotBeNull();
        board!.Habits.ShouldContain(h => h.Id == habitId && h.Title == "Read");
    }

    [Fact]
    public async Task two_accounts_see_separate_boards()
    {
        // Two device tokens minted for distinct accountIds. With Marten's
        // conjoined tenancy on `account_id` (Phase 2d), each request's
        // `IDocumentSession` is scoped to its account so writes by one
        // device are invisible to another.
        var accountA = Guid.NewGuid();
        var accountB = Guid.NewGuid();
        var clientA = _factory.CreateAuthedClient(
            _factory.IssueDeviceToken(accountA, Guid.NewGuid())
        );
        var clientB = _factory.CreateAuthedClient(
            _factory.IssueDeviceToken(accountB, Guid.NewGuid())
        );

        var habitA = Guid.NewGuid();
        var habitB = Guid.NewGuid();

        var respA = await clientA.PostAsJsonAsync(
            "/events",
            new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new
                        {
                            habitId = habitA,
                            title = "A's habit",
                            goal = new { regularity = "day", frequency = 1 },
                        },
                    },
                },
            }
        );
        respA.EnsureSuccessStatusCode();
        var respB = await clientB.PostAsJsonAsync(
            "/events",
            new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new
                        {
                            habitId = habitB,
                            title = "B's habit",
                            goal = new { regularity = "day", frequency = 1 },
                        },
                    },
                },
            }
        );
        respB.EnsureSuccessStatusCode();

        var boardA = await clientA.GetFromJsonAsync<HomeBoard>(
            "/home-board",
            NagJsonOptions.Default
        );
        var boardB = await clientB.GetFromJsonAsync<HomeBoard>(
            "/home-board",
            NagJsonOptions.Default
        );

        boardA!.Habits.ShouldHaveSingleItem();
        boardA.Habits[0].Id.ShouldBe(habitA);
        boardA.Habits[0].Title.ShouldBe("A's habit");

        boardB!.Habits.ShouldHaveSingleItem();
        boardB.Habits[0].Id.ShouldBe(habitB);
        boardB.Habits[0].Title.ShouldBe("B's habit");
    }

    [Fact]
    public async Task check_in_appears_in_period()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid();
        var checkInId = Guid.NewGuid();

        await client.PostAsJsonAsync(
            "/events",
            new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "HabitCreated",
                        payload = new
                        {
                            habitId,
                            title = "Read",
                            goal = new { regularity = "day", frequency = 1 },
                        },
                    },
                },
            }
        );
        await client.PostAsJsonAsync(
            "/events",
            new
            {
                id = Guid.NewGuid(),
                timestamp = DateTimeOffset.UtcNow,
                events = new[]
                {
                    new
                    {
                        type = "CheckInRecorded",
                        payload = new
                        {
                            checkInId,
                            habitId,
                            timestamp = DateTimeOffset.UtcNow,
                        },
                    },
                },
            }
        );

        var board = await client.GetFromJsonAsync<HomeBoard>("/home-board", NagJsonOptions.Default);
        var habit = board!.Habits.Single(h => h.Id == habitId);
        habit.PeriodCheckIns.ShouldContain(c => c.Id == checkInId);
    }
}
