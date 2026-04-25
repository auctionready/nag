using Marten;
using Microsoft.Extensions.Caching.Memory;
using Nag.Core.Domain;

namespace Nag.Api.Auth;

public sealed class DeviceAccountResolver : IDeviceAccountResolver
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly IDocumentStore _store;
    private readonly IMemoryCache _cache;

    public DeviceAccountResolver(IDocumentStore store, IMemoryCache cache)
    {
        _store = store;
        _cache = cache;
    }

    public async ValueTask<Guid?> AccountIdForSubject(string sub, CancellationToken ct)
    {
        if (_cache.TryGetValue<Guid>(CacheKey(sub), out var cached))
            return cached;

        await using var session = _store.LightweightSession();
        var accountId = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .Select(a => a.Id)
            .FirstOrDefaultAsync(ct);

        if (accountId == Guid.Empty)
            return null;

        _cache.Set(CacheKey(sub), accountId, CacheTtl);
        return accountId;
    }

    public void Invalidate(string sub) => _cache.Remove(CacheKey(sub));

    private static string CacheKey(string sub) => $"sub:{sub}";
}
