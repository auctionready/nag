namespace Nag.Core.Domain;

public sealed class Account
{
    public Guid Id { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public string? Email { get; set; }
    public string? IdpSubject { get; set; }
    public DateTimeOffset? UpgradedAt { get; set; }
}
