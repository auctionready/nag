namespace Nag.Api.Auth;

public interface IDeviceAccountResolver
{
    /// <summary>
    /// Resolves a Clerk-verified <c>sub</c> to its bound account id, or
    /// <c>null</c> if no account has been upgraded to that subject.
    /// </summary>
    ValueTask<Guid?> AccountIdForSubject(string sub, CancellationToken ct);

    /// <summary>
    /// Drops the cached mapping. Called by the upgrade endpoint once it
    /// has bound a (possibly new) account to a subject so the next
    /// authenticated request sees the fresh mapping rather than a stale
    /// "not found".
    /// </summary>
    void Invalidate(string sub);
}
