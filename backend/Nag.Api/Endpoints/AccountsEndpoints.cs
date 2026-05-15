using System.Security.Claims;
using Marten;
using Microsoft.AspNetCore.Mvc;
using Nag.Api.Auth;
using Nag.Api.Infrastructure.Http;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Core.Idempotency;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class AccountsEndpoints
{
    /// <summary>
    /// Returns the calling account's bound identity, or 404 if the
    /// account is anonymous (no <c>IdpSubject</c>). The account id is
    /// read from the principal's <c>account_id</c> claim, never the URL.
    /// </summary>
    [Tags("Accounts")]
    [NotTenanted]
    [EndpointName("getAccountsMeIdentity")]
    [ProducesResponseType(typeof(AccountIdentity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [WolverineGet("/accounts/me/identity", RouteName = "getAccountsMeIdentity")]
    public static async Task<IResult> GetAccountIdentity(
        ClaimsPrincipal user,
        IQuerySession session,
        CancellationToken ct
    )
    {
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        if (!Guid.TryParse(accountIdClaim, out var accountId))
        {
            return Results.Json(
                new ErrorResponse(["unauthenticated"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }

        var account = await session.LoadAsync<Account>(accountId, ct);
        if (
            account is null
            || string.IsNullOrEmpty(account.IdpSubject)
            || account.UpgradedAt is null
        )
            return Results.NotFound();

        return Results.Ok(new AccountIdentity(account.IdpSubject, account.UpgradedAt.Value));
    }

    /// <summary>
    /// Binds the calling account to a real identity — sets
    /// <c>IdpSubject</c> from the verified Clerk JWT's <c>sub</c> and
    /// stamps <c>UpgradedAt</c>. The caller must already hold a device
    /// token (issued at <c>/devices/register</c>); both <c>accountId</c>
    /// and <c>deviceId</c> are read from claims, never the body.
    ///
    /// First-time bind returns 201 Created with <c>Location</c> pointing
    /// at <c>GET /accounts/me/identity</c>; idempotent re-bind (same
    /// identity) returns 200 OK with <c>Content-Location</c>.
    ///
    /// Returns 409 if the verified identity is already bound to a
    /// different account — the caller is expected to either fall back to
    /// <c>/devices/pair</c> (join the existing account) or explicitly
    /// take over via <c>DELETE /accounts/by-clerk-identity</c> followed
    /// by a retry of this endpoint.
    /// </summary>
    [NotTenanted]
    [Tags("Accounts")]
    [EndpointName("postAccountsMeIdentity")]
    [ProducesResponseType(typeof(AccountIdentity), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(AccountIdentity), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [WolverinePost("/accounts/me/identity")]
    public static async Task<IResult> SetAccountIdentity(
        SetAccountIdentityRequest request,
        ClaimsPrincipal user,
        IClerkTokenVerifier verifier,
        IDocumentSession session,
        IDeviceAccountResolver resolver,
        TimeProvider clock,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var log = loggerFactory.CreateLogger("AccountsEndpoints.SetAccountIdentity");
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        if (!Guid.TryParse(accountIdClaim, out var accountId))
        {
            return Results.Json(
                new ErrorResponse(["unauthenticated"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        // Logged for traceability — present on device-token callers,
        // missing on Clerk-token callers (which is fine; the log just
        // shows "(none)" in that case).
        var deviceIdClaim = user.FindFirstValue(NagClaimTypes.DeviceId) ?? "(none)";

        if (string.IsNullOrWhiteSpace(request.IdpToken))
            return Results.BadRequest(new ErrorResponse(["idpToken is required"]));

        var verification = await verifier.VerifyAsync(request.IdpToken, ct);
        if (!verification.Ok || string.IsNullOrEmpty(verification.Subject))
        {
            var message = verification.Error ?? "invalid idpToken";
            return Results.Json(
                new ErrorResponse([message]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        var sub = verification.Subject;

        var account = await session.LoadAsync<Account>(accountId, ct);
        if (account is null)
            return Results.NotFound(new ErrorResponse(["account not found"]));

        // Already upgraded — idempotent on (account, sub), 409 on identity mismatch.
        if (!string.IsNullOrEmpty(account.IdpSubject))
        {
            if (account.IdpSubject != sub)
            {
                log.LogWarning(
                    "POST /accounts/me/identity conflict (account bound to a different identity) account={AccountId} device={DeviceId}",
                    accountId,
                    deviceIdClaim
                );
                return Results.Conflict(
                    new ErrorResponse(["account is already bound to a different identity"])
                );
            }
            log.LogInformation(
                "POST /accounts/me/identity no-op (already bound) account={AccountId} device={DeviceId}",
                accountId,
                deviceIdClaim
            );
            return Results.Extensions.FoundAtRoute(
                "getAccountsMeIdentity",
                new { },
                new AccountIdentity(account.IdpSubject, account.UpgradedAt ?? clock.GetUtcNow())
            );
        }

        // Reject if some other account already claims this sub. Without this
        // check, two anonymous accounts could end up sharing one identity.
        // The take-over path is now explicit: client must call
        // DELETE /accounts/by-clerk-identity first to free the binding.
        var existingForSub = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .FirstOrDefaultAsync(ct);
        if (existingForSub is not null && existingForSub.Id != account.Id)
        {
            log.LogWarning(
                "POST /accounts/me/identity conflict (identity bound to another account) account={AccountId} device={DeviceId} otherAccount={OtherAccountId}",
                accountId,
                deviceIdClaim,
                existingForSub.Id
            );
            return Results.Conflict(
                new ErrorResponse(["this identity is already bound to a different account"])
            );
        }

        var now = clock.GetUtcNow();
        account.IdpSubject = sub;
        account.UpgradedAt = now;
        session.Store(account);
        await session.SaveChangesAsync(ct);

        // Drop any cached "no account for sub" result so the next
        // authenticated request resolves the freshly-bound account.
        resolver.Invalidate(sub);

        log.LogInformation(
            "POST /accounts/me/identity bound account={AccountId} device={DeviceId}",
            accountId,
            deviceIdClaim
        );
        return Results.Extensions.CreatedAtRoute(
            "getAccountsMeIdentity",
            new { },
            new AccountIdentity(sub, now)
        );
    }

    /// <summary>
    /// Detaches the calling device's account from its bound Clerk identity.
    /// The caller must be authenticated with a device token (HMAC) — the
    /// account ID is read from the principal's <c>account_id</c> claim, not
    /// the request body, so a stolen Clerk JWT alone can't unbind. Habit
    /// data hangs off the Account row and is untouched; existing device
    /// tokens stay valid because they sign <c>(accountId, deviceId)</c>
    /// directly and don't depend on <c>IdpSubject</c>.
    ///
    /// Edge case worth knowing: any second device that was paired via
    /// <c>/devices/pair</c> before this unbind keeps working (it has its
    /// own device token). But a *new* device that hasn't paired yet will
    /// see <c>/devices/pair</c> return 404 ("no account found for this
    /// identity") until some device re-runs the bind. Idempotent —
    /// unbinding an already-anonymous account is a no-op 204.
    /// </summary>
    [Tags("Accounts")]
    [NotTenanted]
    [EndpointName("deleteAccountsMeIdentity")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [WolverineDelete("/accounts/me/identity")]
    public static async Task<IResult> UnbindAccount(
        ClaimsPrincipal user,
        IDocumentSession session,
        IDeviceAccountResolver resolver,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var log = loggerFactory.CreateLogger("AccountsEndpoints.UnbindAccount");
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        if (!Guid.TryParse(accountIdClaim, out var accountId))
        {
            return Results.Json(
                new ErrorResponse(["unauthenticated"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }

        var account = await session.LoadAsync<Account>(accountId, ct);
        if (account is null)
            return Results.NotFound(new ErrorResponse(["account not found"]));

        var oldSub = account.IdpSubject;
        if (string.IsNullOrEmpty(oldSub))
        {
            // Already anonymous — idempotent 204 so the client can retry
            // safely after a transient network failure.
            log.LogInformation(
                "DELETE /accounts/me/identity no-op (already anonymous) account={AccountId}",
                accountId
            );
            return Results.NoContent();
        }

        account.IdpSubject = null;
        account.UpgradedAt = null;
        session.Store(account);
        await session.SaveChangesAsync(ct);
        resolver.Invalidate(oldSub);

        log.LogInformation("DELETE /accounts/me/identity unbound account={AccountId}", accountId);
        return Results.NoContent();
    }

    /// <summary>
    /// Releases the account-to-Clerk-identity binding owned by whatever
    /// account currently holds the verified <c>sub</c>. The caller proves
    /// ownership of the identity by sending a valid Clerk JWT in the body
    /// — the binding is removed regardless of which account currently
    /// holds it. Idempotent: 204 even if no account is bound.
    ///
    /// Used by the "use this device's data" take-over flow: after
    /// <c>POST /accounts/me/identity</c> returns 409 (identity already
    /// bound elsewhere), the client calls this endpoint to free the
    /// binding, then re-tries the POST to bind it on the caller's
    /// account. Two steps instead of one keeps the take-over explicit
    /// and auditable rather than hiding behind a flag.
    /// </summary>
    [Tags("Accounts")]
    [NotTenanted]
    [EndpointName("deleteAccountsByClerkIdentity")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [WolverineDelete("/accounts/by-clerk-identity")]
    public static async Task<IResult> ReleaseAccountByClerkIdentity(
        ReleaseAccountIdentityRequest request,
        ClaimsPrincipal user,
        IClerkTokenVerifier verifier,
        IDocumentSession session,
        IDeviceAccountResolver resolver,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var log = loggerFactory.CreateLogger("AccountsEndpoints.ReleaseAccountByClerkIdentity");
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        if (!Guid.TryParse(accountIdClaim, out var callerAccountId))
        {
            return Results.Json(
                new ErrorResponse(["unauthenticated"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        var deviceIdClaim = user.FindFirstValue(NagClaimTypes.DeviceId) ?? "(none)";

        if (string.IsNullOrWhiteSpace(request.IdpToken))
            return Results.BadRequest(new ErrorResponse(["idpToken is required"]));

        var verification = await verifier.VerifyAsync(request.IdpToken, ct);
        if (!verification.Ok || string.IsNullOrEmpty(verification.Subject))
        {
            return Results.Json(
                new ErrorResponse([verification.Error ?? "invalid idpToken"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        var sub = verification.Subject;

        var bound = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .FirstOrDefaultAsync(ct);
        if (bound is null)
        {
            log.LogInformation(
                "DELETE /accounts/by-clerk-identity no-op (no account bound) caller={CallerAccountId} device={DeviceId}",
                callerAccountId,
                deviceIdClaim
            );
            return Results.NoContent();
        }

        log.LogWarning(
            "DELETE /accounts/by-clerk-identity released caller={CallerAccountId} device={DeviceId} freedAccount={FreedAccountId}",
            callerAccountId,
            deviceIdClaim,
            bound.Id
        );
        bound.IdpSubject = null;
        bound.UpgradedAt = null;
        session.Store(bound);
        await session.SaveChangesAsync(ct);
        resolver.Invalidate(sub);

        return Results.NoContent();
    }

    /// <summary>
    /// Hard-deletes the calling account and every row associated with it:
    /// the account row, every paired device, the per-account read models
    /// (home board, check-in indexes, weekly/monthly summaries, compliance
    /// history), the inbox of processed envelopes, and every event +
    /// stream tagged with the account's tenant id. The caller must be
    /// authenticated; the account id comes from the principal's
    /// <c>account_id</c> claim, never the URL or body, so a token can only
    /// ever delete its own account. Existing device tokens for this
    /// account become useless once the row is gone (subsequent calls
    /// will resolve to "account not found").
    /// </summary>
    [Tags("Accounts")]
    [NotTenanted]
    [EndpointName("deleteAccountsMe")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [WolverineDelete("/accounts/me")]
    public static async Task<IResult> DeleteAccount(
        ClaimsPrincipal user,
        IDocumentStore store,
        IDeviceAccountResolver resolver,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var log = loggerFactory.CreateLogger("AccountsEndpoints.DeleteAccount");
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        if (!Guid.TryParse(accountIdClaim, out var accountId))
        {
            return Results.Json(
                new ErrorResponse(["unauthenticated"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }

        // Conjoined-tenant rows are tagged with the account id rendered as
        // a string — same shape Marten injects via the `account_id` claim
        // on tenanted endpoints. Open a session in that tenant so
        // `DeleteWhere<T>(_ => true)` is automatically scoped.
        var tenantId = accountId.ToString("D");
        await using var session = store.LightweightSession(tenantId);

        var account = await session.LoadAsync<Account>(accountId, ct);
        if (account is null)
            return Results.NotFound(new ErrorResponse(["account not found"]));

        // Per-account read models and inbox. Each of these types is
        // registered MultiTenanted, so the WHERE clause Marten emits is
        // `tenant_id = @tenant`; the predicate just has to be non-empty.
        session.DeleteWhere<HomeBoard>(_ => true);
        session.DeleteWhere<CheckInState>(_ => true);
        session.DeleteWhere<MonthlyCheckInSummary>(_ => true);
        session.DeleteWhere<WeeklyCheckInSummary>(_ => true);
        session.DeleteWhere<HabitComplianceHistory>(_ => true);
        session.DeleteWhere<ProcessedEnvelope>(_ => true);

        // Devices and Account are single-tenant (they're how we *find* the
        // tenant). Filter explicitly by AccountId.
        session.DeleteWhere<Device>(d => d.AccountId == accountId);
        session.Delete<Account>(accountId);

        await session.SaveChangesAsync(ct);

        // Events are conjoined-tenant but live in `mt_events` /
        // `mt_streams`, which Marten doesn't expose via DeleteWhere.
        // Both tables are created lazily on first event write, so an
        // account with no events at all would see them missing — wrap
        // the deletes in a PL/pgSQL block that catches `undefined_table`.
        // The block needs internal semicolons, which Marten's
        // `QueueSqlCommand` rejects, so run it on a separate connection
        // *after* the main batch commits. Losing atomicity is safe here:
        // tenant_id-tagged event rows that outlive their account are
        // unreachable (no Account/Device row resolves to that tenant)
        // and a subsequent cascade still reaps them.
        // `tenantId` comes from `accountId.ToString("D")` — hex + dashes
        // only, so inlining it into the SQL is safe. PL/pgSQL `DO` blocks
        // don't see outer command parameters, which forces this shape.
        var eventsSchema = store.Options.Events.DatabaseSchemaName;
        await using (var conn = store.Storage.Database.CreateConnection())
        {
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                $@"DO $do$ BEGIN
                     DELETE FROM {eventsSchema}.mt_events WHERE tenant_id = '{tenantId}';
                     DELETE FROM {eventsSchema}.mt_streams WHERE tenant_id = '{tenantId}';
                   EXCEPTION WHEN undefined_table THEN NULL;
                   END $do$;";
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Drop the cached sub→account mapping so a subsequent Clerk-token
        // request for this identity doesn't 200 against a now-dead row.
        if (!string.IsNullOrEmpty(account.IdpSubject))
            resolver.Invalidate(account.IdpSubject);

        // Drop the cached account-exists result so any still-valid device
        // token for this account fails its next authentication attempt
        // (rather than riding a stale "exists=true" for the cache TTL).
        resolver.InvalidateAccount(accountId);

        log.LogInformation("DELETE /accounts/me wiped account={AccountId}", accountId);
        return Results.NoContent();
    }
}
