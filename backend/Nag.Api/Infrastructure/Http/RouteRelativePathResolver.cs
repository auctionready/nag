namespace Nag.Api.Infrastructure.Http;

internal static class RouteRelativePathResolver
{
    public static string ResolvePath(
        HttpContext httpContext,
        string? routeName,
        RouteValueDictionary routeValues
    )
    {
        var linkGenerator = httpContext.RequestServices.GetRequiredService<LinkGenerator>();
        var path = routeName is null
            ? linkGenerator.GetPathByRouteValues(httpContext, routeName: null, routeValues)
            : linkGenerator.GetPathByName(httpContext, routeName, routeValues);

        return string.IsNullOrEmpty(path)
            ? throw new InvalidOperationException("No route matches the supplied values.")
            : path;
    }
}
