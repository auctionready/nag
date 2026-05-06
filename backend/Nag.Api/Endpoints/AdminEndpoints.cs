using System.Security.Cryptography;
using System.Text;
using JasperFx.Events.Daemon;
using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nag.Core.Contracts;
using Nag.Core.Projections;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class AdminEndpoints
{
    /// <summary>
    /// Re-runs every inline projection from the start of the event log.
    /// Used to recover from out-of-band changes to <c>mt_events</c> (raw
    /// SQL inserts, version shifts, etc.) where Marten's normal inline
    /// projection path didn't get a chance to fire. Authenticated by a
    /// pre-shared secret in <c>Nag:AdminSecret</c>; if the config key
    /// isn't set, the endpoint refuses every request.
    ///
    /// Marten's <c>RebuildProjectionAsync</c> rebuilds across every
    /// tenant in one pass — there's no per-tenant rebuild API in the
    /// daemon for conjoined tenancy. For our usage this is fine: the
    /// event log is the source of truth, so re-projecting every tenant
    /// produces the same docs they already had plus a corrected version
    /// for whichever tenant we just patched.
    /// </summary>
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Admin")]
    [EndpointName("postAdminRebuildProjections")]
    [ProducesResponseType(typeof(RebuildProjectionsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status501NotImplemented)]
    [WolverinePost("/admin/rebuild-projections")]
    public static async Task<IResult> RebuildProjections(
        RebuildProjectionsRequest request,
        IDocumentStore store,
        IConfiguration config,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        var expected = config["Nag:AdminSecret"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            return Results.Json(
                new ErrorResponse(["admin secret not configured (set Nag:AdminSecret)"]),
                statusCode: StatusCodes.Status501NotImplemented
            );
        }

        if (!ConstantTimeEquals(expected, request.Secret ?? string.Empty))
        {
            return Results.Json(
                new ErrorResponse(["unauthorized"]),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }

        var log = loggerFactory.CreateLogger("AdminEndpoints.RebuildProjections");
        var rebuilt = new List<string>();

        // Order matters only insofar as later projections might depend
        // on earlier ones; ours don't, so the registration order is
        // fine.
        var projectionTypes = new[]
        {
            typeof(HomeBoardProjection),
            typeof(CheckInIndexProjection),
            typeof(MonthlyCheckInSummaryProjection),
            typeof(WeeklyCheckInSummaryProjection),
            typeof(HabitComplianceHistoryProjection),
        };

        using var daemon = await store.BuildProjectionDaemonAsync();
        foreach (var projType in projectionTypes)
        {
            log.LogInformation("rebuilding projection {Projection}", projType.Name);
            await daemon.RebuildProjectionAsync(projType, ct);
            rebuilt.Add(projType.Name);
            log.LogInformation("rebuilt projection {Projection}", projType.Name);
        }

        return Results.Ok(new RebuildProjectionsResponse(rebuilt));
    }

    /// <summary>
    /// Constant-time string comparison so a timing side channel can't be
    /// used to brute-force the configured secret one character at a time.
    /// </summary>
    private static bool ConstantTimeEquals(string expected, string candidate)
    {
        var a = Encoding.UTF8.GetBytes(expected);
        var b = Encoding.UTF8.GetBytes(candidate);
        // FixedTimeEquals requires equal-length inputs, but we still want
        // constant-time behaviour on length mismatch — pad the shorter
        // one and compare against a sentinel so we always do the same
        // amount of work.
        if (a.Length != b.Length)
        {
            // Touch every byte to keep the work proportional to the
            // longer input, then return false.
            var dummy = new byte[Math.Max(a.Length, b.Length)];
            CryptographicOperations.FixedTimeEquals(dummy, dummy);
            return false;
        }
        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}

public sealed record RebuildProjectionsRequest(string Secret);

public sealed record RebuildProjectionsResponse(IReadOnlyList<string> Rebuilt);
