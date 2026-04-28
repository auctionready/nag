namespace Nag.Core.Domain;

public sealed class Account
{
    public Guid Id { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public string? Email { get; set; }
    public string? IdpSubject { get; set; }
    public DateTimeOffset? UpgradedAt { get; set; }

    /// <summary>
    /// Day of week the account treats as the start of a week. Drives
    /// week-bounded period calculations (compliance windows, weekly
    /// summary projections, the home-board's weekly traffic light, the
    /// detail screen's week strip). Default is Monday.
    /// </summary>
    public DayOfWeek WeekStartsOn { get; set; } = DayOfWeek.Monday;
}
