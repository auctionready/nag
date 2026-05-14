using Marten;
using Microsoft.Extensions.Caching.Memory;
using Nag.Core.Domain;

namespace Nag.Api.Auth;

public sealed class DeviceAccountResolver(IDocumentStore store, IMemoryCache cache)
    : IDeviceAccountResolver
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public async ValueTask<Guid?> AccountIdForSubject(string sub, CancellationToken ct)
    {
        if (cache.TryGetValue<Guid>(SubKey(sub), out var cached))
            return cached;

        await using var session = store.LightweightSession();
        var accountId = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .Select(a => a.Id)
            .FirstOrDefaultAsync(ct);

        if (accountId == Guid.Empty)
            return null;

        cache.Set(SubKey(sub), accountId, CacheTtl);
        return accountId;
    }

    public async ValueTask<bool> AccountExists(Guid accountId, CancellationToken ct)
    {
        if (cache.TryGetValue<bool>(AccountKey(accountId), out var cached))
            return cached;

        await using var session = store.LightweightSession();
        var exists = await session.Query<Account>().Where(a => a.Id == accountId).AnyAsync(ct);

        cache.Set(AccountKey(accountId), exists, CacheTtl);
        return exists;
    }

    public void Invalidate(string sub) => cache.Remove(SubKey(sub));

    public void InvalidateAccount(Guid accountId) => cache.Remove(AccountKey(accountId));

    private static string SubKey(string sub) => $"sub:{sub}";

    private static string AccountKey(Guid id) => $"acct:{id:D}";
}
