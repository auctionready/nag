using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class AccountsEndpoints
{
    /// <summary>
    /// Binds the calling device's anonymous account to a real identity.
    /// The caller supplies its <c>deviceId</c> (issued at registration) and
    /// a Clerk-issued <c>idpToken</c>; on success the account stores the
    /// JWT's <c>sub</c> as <c>IdpSubject</c> and stamps <c>UpgradedAt</c>.
    /// </summary>
    [AllowAnonymous]
    [Tags("Accounts")]
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
        var existingForSub = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .FirstOrDefaultAsync(ct);
        if (existingForSub is not null && existingForSub.Id != account.Id)
        {
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

        return Results.Ok(
            new UpgradeAccountResponse(account.Id, sub, now, tokens.Issue(account.Id, device.Id))
        );
    }
}
