using Marten;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

/// <summary>
/// Per-period read endpoints the mobile app calls when the user browses
/// past months/weeks. The device only retains current + previous month
/// locally; older periods are filled in on demand from these summaries.
///
/// Unknown keys return an empty (no-habits) summary at 200 — same shape
/// as <c>/home-board</c> when the projection hasn't been seeded — so
/// the client can distinguish "no events yet" via an empty list rather
/// than a 404.
/// </summary>
public static class CheckInSummaryEndpoints
{
    [Tags("Read Models")]
    [EndpointName("getMonthlyCheckInSummary")]
    [ProducesResponseType(typeof(MonthlyCheckInSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [WolverineGet("/check-ins/monthly/{year:int}/{month:int}")]
    public static async Task<IResult> GetMonthlyCheckInSummary(
        int year,
        int month,
        IQuerySession session,
        CancellationToken ct
    )
    {
        if (year < 1 || month < 1 || month > 12)
        {
            return Results.BadRequest(new { error = "year must be positive and month in [1, 12]" });
        }

        var id = $"{year:D4}-{month:D2}";
        var doc = await session.LoadAsync<MonthlyCheckInSummary>(id, ct);
        return doc is null
            ? Results.Ok(
                new MonthlyCheckInSummary
                {
                    Id = id,
                    MonthStart = new DateTimeOffset(year, month, 1, 0, 0, 0, TimeSpan.Zero),
                }
            )
            : Results.Ok(doc);
    }

    [Tags("Read Models")]
    [EndpointName("getWeeklyCheckInSummary")]
    [ProducesResponseType(typeof(WeeklyCheckInSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [WolverineGet("/check-ins/weekly/{year:int}/{month:int}/{day:int}")]
    public static async Task<IResult> GetWeeklyCheckInSummary(
        int year,
        int month,
        int day,
        IQuerySession session,
        CancellationToken ct
    )
    {
        DateTimeOffset weekStart;
        try
        {
            weekStart = new DateTimeOffset(year, month, day, 0, 0, 0, TimeSpan.Zero);
        }
        catch (ArgumentOutOfRangeException)
        {
            return Results.BadRequest(new { error = "invalid year/month/day" });
        }

        if (weekStart.DayOfWeek != DayOfWeek.Sunday)
        {
            return Results.BadRequest(
                new { error = "week start date must be a Sunday (yyyy-mm-dd)" }
            );
        }

        var id = $"{year:D4}-{month:D2}-{day:D2}";
        var doc = await session.LoadAsync<WeeklyCheckInSummary>(id, ct);
        return doc is null
            ? Results.Ok(new WeeklyCheckInSummary { Id = id, WeekStart = weekStart })
            : Results.Ok(doc);
    }
}
