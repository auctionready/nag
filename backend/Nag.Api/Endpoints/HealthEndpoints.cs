using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class HealthEndpoints
{
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Health")]
    [EndpointName("getHealth")]
    [WolverineGet("/health")]
    public static NoContent Health() => TypedResults.NoContent();
}
