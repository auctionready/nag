using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nag.Api.Auth;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class DevicesEndpoints
{
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Devices")]
    [EndpointName("postDevicesRegister")]
    [ProducesResponseType(typeof(RegisterDeviceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/devices/register")]
    public static async Task<IResult> RegisterDevice(
        RegisterDeviceRequest request,
        IDocumentSession session,
        IDeviceTokenIssuer tokens,
        TimeProvider clock,
        CancellationToken ct
    )
    {
        if (request.DeviceId == Guid.Empty)
            return Results.BadRequest(new ErrorResponse(["deviceId is required"]));

        var existing = await session.LoadAsync<Device>(request.DeviceId, ct);
        if (existing is not null)
        {
            return Results.Ok(
                new RegisterDeviceResponse(
                    existing.AccountId,
                    existing.Id,
                    existing.RegisteredAt,
                    tokens.Issue(existing.AccountId, existing.Id)
                )
            );
        }

        var now = clock.GetUtcNow();
        var account = new Account { Id = Guid.NewGuid(), CreatedAt = now };
        var device = new Device
        {
            Id = request.DeviceId,
            AccountId = account.Id,
            Label = request.Label,
            RegisteredAt = now,
        };

        session.Store(account);
        session.Store(device);
        await session.SaveChangesAsync(ct);

        return Results.Ok(
            new RegisterDeviceResponse(
                account.Id,
                device.Id,
                device.RegisteredAt,
                tokens.Issue(account.Id, device.Id)
            )
        );
    }

    /// <summary>
    /// Pairs a new device against an account that has already been upgraded
    /// (its <c>IdpSubject</c> matches the verified token's <c>sub</c>).
    /// Refuses to silently create a new account — the user must
    /// upgrade an existing device first via <c>/accounts/upgrade</c>.
    /// </summary>
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Devices")]
    [EndpointName("postDevicesPair")]
    [ProducesResponseType(typeof(PairDeviceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [WolverinePost("/devices/pair")]
    public static async Task<IResult> PairDevice(
        PairDeviceRequest request,
        IClerkTokenVerifier verifier,
        IDocumentSession session,
        IDeviceTokenIssuer tokens,
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
            return Results.Json(
                new ErrorResponse([verification.Error ?? "invalid idpToken"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        var sub = verification.Subject;

        var account = await session
            .Query<Account>()
            .Where(a => a.IdpSubject == sub)
            .FirstOrDefaultAsync(ct);
        if (account is null)
        {
            return Results.NotFound(
                new ErrorResponse([
                    "no account found for this identity — upgrade your first device first",
                ])
            );
        }

        var existing = await session.LoadAsync<Device>(request.DeviceId, ct);
        if (existing is not null)
        {
            if (existing.AccountId == account.Id)
            {
                return Results.Ok(
                    new PairDeviceResponse(
                        account.Id,
                        existing.Id,
                        existing.RegisteredAt,
                        tokens.Issue(account.Id, existing.Id)
                    )
                );
            }

            // Device currently belongs to a different account. If that
            // account is anonymous (never upgraded), this is the typical
            // second-device flow: the device auto-registered an anonymous
            // account at boot, and now its user is signing in. Re-parent
            // the device to the upgraded account that owns the verified
            // identity, leaving the orphaned anonymous account in place.
            // Refusing to re-parent when the source account itself owns
            // a real identity keeps the cross-user case loud.
            var sourceAccount = await session.LoadAsync<Account>(existing.AccountId, ct);
            if (sourceAccount is null || !string.IsNullOrEmpty(sourceAccount.IdpSubject))
            {
                return Results.Conflict(
                    new ErrorResponse(["deviceId is already paired with a different account"])
                );
            }

            // Device.AccountId is init-only; replace the row in-place via
            // Marten's upsert-on-Id semantics rather than mutating.
            var rebound = new Device
            {
                Id = existing.Id,
                AccountId = account.Id,
                Label = request.Label ?? existing.Label,
                RegisteredAt = existing.RegisteredAt,
            };
            session.Store(rebound);
            await session.SaveChangesAsync(ct);

            return Results.Ok(
                new PairDeviceResponse(
                    account.Id,
                    rebound.Id,
                    rebound.RegisteredAt,
                    tokens.Issue(account.Id, rebound.Id)
                )
            );
        }

        var now = clock.GetUtcNow();
        var device = new Device
        {
            Id = request.DeviceId,
            AccountId = account.Id,
            Label = request.Label,
            RegisteredAt = now,
        };
        session.Store(device);
        await session.SaveChangesAsync(ct);

        return Results.Ok(
            new PairDeviceResponse(
                account.Id,
                device.Id,
                device.RegisteredAt,
                tokens.Issue(account.Id, device.Id)
            )
        );
    }
}
