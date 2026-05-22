using System.Security.Claims;
using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nag.Api.Auth;
using Nag.Api.Infrastructure.Http;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class DevicesEndpoints
{
    /// <summary>
    /// Returns the calling device's row (id, label, account, registered-at).
    /// Both the device id and the account id are read from the device-token
    /// claims, so a token can only ever read its own device.
    ///
    /// Not invoked by the mobile app today — it's the PRG target that
    /// <c>POST /devices</c> and <c>POST /accounts/me/devices</c> point at
    /// via <c>Location</c> / <c>Content-Location</c> headers, so register
    /// and pair can return a proper 201/200 with an addressable resource.
    /// </summary>
    [Tags("Devices")]
    [EndpointName("getDevicesMe")]
    [ProducesResponseType(typeof(GetDeviceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [WolverineGet("/devices/me", RouteName = "getDevicesMe")]
    public static async Task<IResult> GetDeviceMe(
        ClaimsPrincipal user,
        IQuerySession session,
        CancellationToken ct
    )
    {
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        var deviceIdClaim = user.FindFirstValue(NagClaimTypes.DeviceId);
        if (
            !Guid.TryParse(accountIdClaim, out var accountId)
            || !Guid.TryParse(deviceIdClaim, out var deviceId)
        )
        {
            return Results.Extensions.Unauthorized(new ErrorResponse(["unauthenticated"]));
        }

        var device = await session.LoadAsync<Device>(deviceId, ct);
        if (device is null || device.AccountId != accountId)
            return Results.NotFound();

        return Results.Ok(
            new GetDeviceResponse(device.AccountId, device.Id, device.Label, device.RegisteredAt)
        );
    }

    /// <summary>
    /// Registers a fresh anonymous account + device pair. The "register"
    /// verb is the URL collection root because no owning account exists
    /// yet to scope under <c>/accounts/{...}/devices</c>; once a Clerk
    /// identity is in play, <c>POST /accounts/me/devices</c> is the
    /// matching create-under-collection route.
    /// </summary>
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Devices")]
    [EndpointName("postDevicesRegister")]
    [ProducesResponseType(typeof(RegisterDeviceResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(RegisterDeviceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [WolverinePost("/devices")]
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
            var body = new RegisterDeviceResponse(
                existing.AccountId,
                existing.Id,
                existing.RegisteredAt,
                tokens.Issue(existing.AccountId, existing.Id)
            );
            return Results.Extensions.FoundAtRoute("getDevicesMe", new { }, body);
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

        var created = new RegisterDeviceResponse(
            account.Id,
            device.Id,
            device.RegisteredAt,
            tokens.Issue(account.Id, device.Id)
        );
        return Results.Extensions.CreatedAtRoute("getDevicesMe", new { }, created);
    }

    /// <summary>
    /// Creates a device under the account identified by the Clerk JWT in
    /// the request body. The account must already be upgraded (its
    /// <c>IdpSubject</c> matches the verified token's <c>sub</c>);
    /// refuses to silently create a new account — the user must
    /// upgrade an existing device first via <c>/accounts/me/identity</c>.
    ///
    /// "me" is resolved from the body-borne <c>idpToken</c>, matching the
    /// pattern already established by <c>DELETE /accounts/by-clerk-identity</c>.
    /// Kept <c>[AllowAnonymous]</c> because the calling device may not yet
    /// hold a device token (the post-sign-in second-device flow).
    /// </summary>
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Devices")]
    [EndpointName("postDevicesPair")]
    [ProducesResponseType(typeof(PairDeviceResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(PairDeviceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [WolverinePost("/accounts/me/devices")]
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
            return Results.Extensions.Unauthorized(
                new ErrorResponse([verification.Error ?? "invalid idpToken"])
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
                var body = new PairDeviceResponse(
                    account.Id,
                    existing.Id,
                    existing.RegisteredAt,
                    tokens.Issue(account.Id, existing.Id)
                );
                return Results.Extensions.FoundAtRoute("getDevicesMe", new { }, body);
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

            var reboundBody = new PairDeviceResponse(
                account.Id,
                rebound.Id,
                rebound.RegisteredAt,
                tokens.Issue(account.Id, rebound.Id)
            );
            return Results.Extensions.FoundAtRoute("getDevicesMe", new { }, reboundBody);
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

        var created = new PairDeviceResponse(
            account.Id,
            device.Id,
            device.RegisteredAt,
            tokens.Issue(account.Id, device.Id)
        );
        return Results.Extensions.CreatedAtRoute("getDevicesMe", new { }, created);
    }

#if RESERVED_ENDPOINTS
    // `DELETE /devices/me` was wired for the "start a new account"
    // branch of the old sign-in conflict prompt, which got cut from
    // the client (sign-out → Sign out completely now resets the local
    // identity row instead of cascading the server-side account).
    // Compiled out by default so it doesn't register with Wolverine,
    // doesn't appear in the route table, doesn't take up cold-start
    // time, and doesn't show up in the generated OpenAPI document.
    // Define `RESERVED_ENDPOINTS` (e.g. `dotnet build
    // -p:DefineConstants=RESERVED_ENDPOINTS`) to restore it; the same
    // gate covers the corresponding test methods in
    // `Nag.Tests/Api/DevicesEndpointsTests.cs`.

    /// <summary>
    /// Unpairs the calling device from its account. Both the account id and
    /// device id are read from the device-token claims, never the URL or
    /// body, so a token can only unpair its own device.
    ///
    /// If this was the last device on the account, the account itself is
    /// cascade-deleted — same cleanup as <c>DELETE /accounts/me</c> — so the
    /// server never holds an account with no devices attached. When other
    /// devices remain, the account row is left untouched and they keep
    /// working through their own device tokens.
    ///
    /// Idempotent: deleting a device that no longer exists is a 204 no-op,
    /// so the client can safely retry after a transient failure.
    /// </summary>
    [Tags("Devices")]
    [NotTenanted]
    [EndpointName("deleteDevicesMe")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [WolverineDelete("/devices/me")]
    public static async Task<IResult> UnregisterDevice(
        ClaimsPrincipal user,
        IDocumentStore store,
        IDeviceAccountResolver resolver,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var log = loggerFactory.CreateLogger("DevicesEndpoints.UnregisterDevice");
        var accountIdClaim = user.FindFirstValue(NagClaimTypes.AccountId);
        var deviceIdClaim = user.FindFirstValue(NagClaimTypes.DeviceId);
        if (
            !Guid.TryParse(accountIdClaim, out var accountId)
            || !Guid.TryParse(deviceIdClaim, out var deviceId)
        )
        {
            return Results.Extensions.Unauthorized(new ErrorResponse(["unauthenticated"]));
        }

        // Open the session inside the caller's tenant so the cascade
        // branch can rely on `DeleteWhere<T>(_ => true)` against
        // MultiTenanted documents — same pattern as `DELETE /accounts/me`.
        var tenantId = accountId.ToString("D");
        await using var session = store.LightweightSession(tenantId);

        var device = await session.LoadAsync<Device>(deviceId, ct);
        if (device is null || device.AccountId != accountId)
        {
            // Already gone (or never owned by this caller) — 204 keeps the
            // sign-out path safely retryable.
            log.LogInformation(
                "DELETE /devices/me no-op (device gone) account={AccountId} device={DeviceId}",
                accountId,
                deviceId
            );
            return Results.NoContent();
        }

        var remaining = await session
            .Query<Device>()
            .CountAsync(d => d.AccountId == accountId && d.Id != deviceId, ct);

        if (remaining > 0)
        {
            session.Delete<Device>(deviceId);
            await session.SaveChangesAsync(ct);
            log.LogInformation(
                "DELETE /devices/me unpaired account={AccountId} device={DeviceId} remaining={Remaining}",
                accountId,
                deviceId,
                remaining
            );
            return Results.NoContent();
        }

        // Last device — cascade-delete the account so we don't leak an
        // ownerless account row. Mirrors `DELETE /accounts/me`'s cleanup:
        // per-account read models + inbox via tenant scoping, devices +
        // account via explicit ids, and events/streams via raw SQL because
        // Marten doesn't expose `DeleteWhere` for `mt_events`/`mt_streams`.
        var account = await session.LoadAsync<Account>(accountId, ct);

        session.DeleteWhere<HomeBoard>(_ => true);
        session.DeleteWhere<CheckInState>(_ => true);
        session.DeleteWhere<MonthlyCheckInSummary>(_ => true);
        session.DeleteWhere<WeeklyCheckInSummary>(_ => true);
        session.DeleteWhere<HabitComplianceHistory>(_ => true);
        session.DeleteWhere<ProcessedEnvelope>(_ => true);

        session.Delete<Device>(deviceId);
        if (account is not null)
            session.Delete<Account>(accountId);

        await session.SaveChangesAsync(ct);

        // Marten creates `mt_events` / `mt_streams` lazily on first event
        // write, so accounts that never emitted one will see those tables
        // missing here. Run the events cleanup in a separate connection
        // *after* the main batch commits — `QueueSqlCommand` can't
        // tolerate the semicolons a PL/pgSQL `EXCEPTION` clause needs.
        // Losing atomicity is fine: tenant_id-tagged event rows that
        // outlive their account are unreachable (no Account/Device row
        // resolves to that tenant), and the next cascade still reaps them.
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

        if (account is not null && !string.IsNullOrEmpty(account.IdpSubject))
            resolver.Invalidate(account.IdpSubject);
        resolver.InvalidateAccount(accountId);

        log.LogInformation(
            "DELETE /devices/me cascaded — last device, wiped account={AccountId} device={DeviceId}",
            accountId,
            deviceId
        );
        return Results.NoContent();
    }
#endif
}
