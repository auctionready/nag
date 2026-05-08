using System.Security.Claims;
using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Core.Idempotency;
using Nag.Core.ReadModels;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class AccountsEndpoints
{
    /// <summary>
    /// Binds the calling device's anonymous account to a real identity.
    /// The caller supplies its <c>deviceId</c> (issued at registration) and
    /// a Clerk-issued <c>idpToken</c>; on success the account stores the
    /// JWT's <c>sub</c> as <c>IdpSubject</c> and stamps <c>UpgradedAt</c>.
    ///
    /// The default behaviour returns 409 if some other account already
    /// claims the verified identity — the caller is expected to fall back
    /// to <c>/devices/pair</c> so the device joins the existing account.
    /// Setting <c>Force=true</c> opts into the inverse: unbind the
    /// existing account and bind this device's account to the identity
    /// instead. Used by the "use this device's data" sign-in flow when
    /// the user wants their local data to be canonical over whatever
    /// the server has on the other account.
    /// </summary>
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Accounts")]
    [EndpointName("postAccountsUpgrade")]
    [ProducesResponseType(typeof(UpgradeAccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [WolverinePost("/accounts/upgrade")]
    public static async Task<IResult> UpgradeAccount(
        UpgradeAccountRequest request,
        IClerkTokenVerifier verifier,
        IDocumentSession session,
        IDeviceTokenIssuer tokens,
        IDeviceAccountResolver resolver,
        TimeProvider clock,
        CancellationToken ct
    )
    {
        if (request.DeviceId == Guid.Empty)
            return Results.BadRequest(new ErrorResponse(["deviceId is required"]));
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

        var device = await session.LoadAsync<Device>(request.DeviceId, ct);
        if (device is null)
            return Results.NotFound(new ErrorResponse(["unknown device"]));

        var account = await session.LoadAsync<Account>(device.AccountId, ct);
        if (account is null)
            return Results.NotFound(new ErrorResponse(["account not found for device"]));

        // Already upgraded — idempotent on (account, sub), 409 on identity mismatch.
        if (!string.IsNullOrEmpty(account.IdpSubject))
        {
            if (account.IdpSubject == sub)
            {
                return Results.Ok(
                    new UpgradeAccountResponse(
                        account.Id,
                        account.IdpSubject,
                        account.UpgradedAt ?? clock.GetUtcNow(),
                        tokens.Issue(account.Id, device.Id)
                    )
                );
            }
            return Results.Conflict(
                new ErrorResponse(["account is already bound to a different identity"])
            );
        }

        // Reject if some other account already claims this sub. Without this
        // check, two anonymous accounts could end up sharing one identity.
        // The Force=true escape hatch is the "use this device's data" flow:
        // the user has chosen to move the identity from the existing account
        // onto this device's account, so we unbind the loser inline.
        var existingForSub = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .FirstOrDefaultAsync(ct);
        if (existingForSub is not null && existingForSub.Id != account.Id)
        {
            if (!request.Force)
            {
                return Results.Conflict(
                    new ErrorResponse(["this identity is already bound to a different account"])
                );
            }
            existingForSub.IdpSubject = null;
            existingForSub.UpgradedAt = null;
            session.Store(existingForSub);
            // Drop any cached resolution so the next request keyed by sub
            // doesn't keep pointing at the now-orphaned account.
            resolver.Invalidate(sub);
        }

        var now = clock.GetUtcNow();
        account.IdpSubject = sub;
        account.UpgradedAt = now;
        session.Store(account);
        await session.SaveChangesAsync(ct);

        // Drop any cached "no account for sub" result so the next
        // authenticated request resolves the freshly-bound account.
        resolver.Invalidate(sub);

        return Results.Ok(
            new UpgradeAccountResponse(account.Id, sub, now, tokens.Issue(account.Id, device.Id))
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
    /// identity") until some device re-runs <c>/accounts/upgrade</c> to
    /// rebind. Idempotent — unbinding an already-anonymous account is a
    /// no-op 200.
    /// </summary>
    [Tags("Accounts")]
    [NotTenanted]
    [EndpointName("postAccountsUnbind")]
    [ProducesResponseType(typeof(UnbindAccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [WolverinePost("/accounts/unbind")]
    public static async Task<IResult> UnbindAccount(
        ClaimsPrincipal user,
        IDocumentSession session,
        IDeviceAccountResolver resolver,
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
        if (account is null)
            return Results.NotFound(new ErrorResponse(["account not found"]));

        var oldSub = account.IdpSubject;
        if (string.IsNullOrEmpty(oldSub))
        {
            // Already anonymous — idempotent 200 so the client can retry
            // safely after a transient network failure.
            return Results.Ok(new UnbindAccountResponse(account.Id));
        }

        account.IdpSubject = null;
        account.UpgradedAt = null;
        session.Store(account);
        await session.SaveChangesAsync(ct);
        resolver.Invalidate(oldSub);

        return Results.Ok(new UnbindAccountResponse(account.Id));
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
    [ProducesResponseType(typeof(DeleteAccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [WolverineDelete("/accounts/me")]
    public static async Task<IResult> DeleteAccount(
        ClaimsPrincipal user,
        IDocumentStore store,
        IDeviceAccountResolver resolver,
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

        // Events are conjoined-tenant but live in `mt_events` /
        // `mt_streams`, which Marten doesn't expose via DeleteWhere.
        // Drop them in the same unit of work via raw SQL so a partial
        // failure doesn't leave the account half-deleted.
        var eventsSchema = store.Options.Events.DatabaseSchemaName;
        session.QueueSqlCommand(
            $"delete from {eventsSchema}.mt_events where tenant_id = ?",
            tenantId
        );
        session.QueueSqlCommand(
            $"delete from {eventsSchema}.mt_streams where tenant_id = ?",
            tenantId
        );

        await session.SaveChangesAsync(ct);

        // Drop the cached sub→account mapping so a subsequent Clerk-token
        // request for this identity doesn't 200 against a now-dead row.
        if (!string.IsNullOrEmpty(account.IdpSubject))
            resolver.Invalidate(account.IdpSubject);

        return Results.Ok(new DeleteAccountResponse(accountId));
    }
}
