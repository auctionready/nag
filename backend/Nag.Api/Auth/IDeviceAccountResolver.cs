namespace Nag.Api.Auth;

public interface IDeviceAccountResolver
{
    /// <summary>
    /// Resolves a Clerk-verified <c>sub</c> to its bound account id, or
    /// <c>null</c> if no account has been upgraded to that subject.
    /// </summary>
    ValueTask<Guid?> AccountIdForSubject(string sub, CancellationToken ct);

    /// <summary>
    /// Returns <c>true</c> if an <c>Account</c> row exists for the id, with
    /// short-TTL caching so the auth handler doesn't query Postgres on
    /// every authenticated request. Used to refuse device tokens whose
    /// account has been deleted out-of-band (e.g. via
    /// <c>DELETE /accounts/me</c>) — without this check the token would
    /// keep authenticating, with the orphan tenant id silently writing
    /// events that re-create per-tenant state.
    /// </summary>
    ValueTask<bool> AccountExists(Guid accountId, CancellationToken ct);

    /// <summary>
    /// Drops the cached mapping. Called by the upgrade endpoint once it
    /// has bound a (possibly new) account to a subject so the next
    /// authenticated request sees the fresh mapping rather than a stale
    /// "not found".
    /// </summary>
    void Invalidate(string sub);

    /// <summary>
    /// Drops the cached account-exists result. Called by the delete
    /// endpoint so a still-valid device token for the just-deleted
    /// account fails the next request rather than authenticating off a
    /// stale "exists=true".
    /// </summary>
    void InvalidateAccount(Guid accountId);
}
