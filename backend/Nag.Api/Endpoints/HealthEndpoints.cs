using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class HealthEndpoints
{
    [AllowAnonymous]
    [NotTenanted]
    [Tags("Health")]
    [EndpointName("getHealth")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [WolverineGet("/health")]
    public static IResult Health() => Results.NoContent();
}
