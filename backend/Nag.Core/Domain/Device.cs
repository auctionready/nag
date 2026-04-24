namespace Nag.Core.Domain;

public sealed class Device
{
    public Guid Id { get; init; }
    public Guid AccountId { get; init; }
    public string? Label { get; set; }
    public DateTimeOffset RegisteredAt { get; init; }
}
