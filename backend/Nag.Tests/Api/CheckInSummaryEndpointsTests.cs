using System.Net;
using System.Net.Http.Json;
using Nag.Core.Contracts;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Api;

[Collection(PostgresCollection.Name)]
public class CheckInSummaryEndpointsTests : IClassFixture<CheckInSummaryEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public CheckInSummaryEndpointsTests(PostgresFixture pg, Factory factory)
    {
        _factory = factory;
        _factory.ConnectionString = pg.ConnectionString;
        _factory.SchemaName = "api_checkin_summary";
    }

    public sealed class Factory : NagApiFactory;

    private HttpClient AuthedClient() => _factory.CreateAuthedClient();

    [Fact]
    public async Task monthly_summary_is_populated_after_a_check_in_in_that_month()
    {
        var client = AuthedClient();
        var habitId = Guid.NewGuid();
        var checkInId = Guid.NewGuid();
        var ts = new DateTimeOffset(2026, 4, 15, 9, 0, 0, TimeSpan.Zero);

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
                    timestamp = ts,
                },
            }
        );

        var summary = await client.GetFromJsonAsync<MonthlyCheckInSummary>(
            "/check-ins/monthly/2026/4",
            NagJsonOptions.Default
        );
        summary.ShouldNotBeNull();
        summary!.Id.ShouldBe("2026-04");
        var habit = summary.Habits.Single(h => h.HabitId == habitId);
        habit.CheckIns.ShouldContain(c => c.Id == checkInId);
    }

    [Fact]
    public async Task weekly_summary_returns_empty_for_period_with_no_events()
    {
        var client = AuthedClient();

        // Sunday 2026-04-26 — never written to.
        var summary = await client.GetFromJsonAsync<WeeklyCheckInSummary>(
            "/check-ins/weekly/2026/4/26",
            NagJsonOptions.Default
        );
        summary.ShouldNotBeNull();
        summary!.Habits.ShouldBeEmpty();
    }

    [Fact]
    public async Task monthly_summary_rejects_invalid_month()
    {
        var client = AuthedClient();
        var resp = await client.GetAsync("/check-ins/monthly/2026/13");
        resp.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task weekly_summary_rejects_non_sunday()
    {
        var client = AuthedClient();
        // 2026-04-27 is a Monday.
        var resp = await client.GetAsync("/check-ins/weekly/2026/4/27");
        resp.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
