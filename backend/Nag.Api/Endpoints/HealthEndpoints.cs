using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace Nag.Api.Endpoints;

public static class HealthEndpoints
{
    [AllowAnonymous]
    [Tags("Health")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [WolverineGet("/health")]
    public static IResult Health() => Results.NoContent();
}
