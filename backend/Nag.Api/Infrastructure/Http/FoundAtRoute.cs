using System.Reflection;
using Microsoft.AspNetCore.Http.Metadata;

namespace Nag.Api.Infrastructure.Http;

public static class FoundAtRouteResultsExtensions
{
    public static IResult FoundAtRoute(
        this IResultExtensions _,
        string? routeName = null,
        object? routeValues = null
    ) => new FoundAtRoute(routeName, routeValues);

    public static IResult FoundAtRoute<TValue>(
        this IResultExtensions _,
        string? routeName,
        object? routeValues,
        TValue? value
    ) => new FoundAtRoute<TValue>(routeName, routeValues, value);
}

/// <summary>
/// An <see cref="IResult"/> that on execution sets <c>Content-Location</c> to the
/// relative path of a registered route and writes 200 OK.
/// </summary>
public sealed class FoundAtRoute : IResult, IEndpointMetadataProvider, IStatusCodeHttpResult
{
    internal FoundAtRoute(string? routeName, object? routeValues)
        : this(routeName, new RouteValueDictionary(routeValues)) { }

    internal FoundAtRoute(string? routeName, RouteValueDictionary? routeValues)
    {
        RouteName = routeName;
        RouteValues = routeValues ?? new RouteValueDictionary();
    }

    public string? RouteName { get; }

    public RouteValueDictionary RouteValues { get; }

    public int StatusCode => StatusCodes.Status200OK;

    int? IStatusCodeHttpResult.StatusCode => StatusCode;

    public Task ExecuteAsync(HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var path = ResolveRelativePath(httpContext, RouteName, RouteValues);
        httpContext.Response.Headers.ContentLocation = path;
        httpContext.Response.StatusCode = StatusCode;
        return Task.CompletedTask;
    }

    static void IEndpointMetadataProvider.PopulateMetadata(
        MethodInfo method,
        EndpointBuilder builder
    )
    {
        ArgumentNullException.ThrowIfNull(method);
        ArgumentNullException.ThrowIfNull(builder);

        builder.Metadata.Add(
            new ProducesResponseTypeMetadata(StatusCodes.Status200OK, typeof(void))
        );
    }

    internal static string ResolveRelativePath(
        HttpContext httpContext,
        string? routeName,
        RouteValueDictionary routeValues
    )
    {
        var linkGenerator = httpContext.RequestServices.GetRequiredService<LinkGenerator>();
        var path = routeName is null
            ? linkGenerator.GetPathByRouteValues(httpContext, routeName: null, routeValues)
            : linkGenerator.GetPathByName(httpContext, routeName, routeValues);

        if (string.IsNullOrEmpty(path))
        {
            throw new InvalidOperationException("No route matches the supplied values.");
        }

        return path;
    }
}

/// <summary>
/// An <see cref="IResult"/> that on execution sets <c>Content-Location</c> to the
/// relative path of a registered route, writes <typeparamref name="TValue"/> as JSON,
/// and returns 200 OK.
/// </summary>
public sealed class FoundAtRoute<TValue>
    : IResult,
        IEndpointMetadataProvider,
        IStatusCodeHttpResult,
        IValueHttpResult,
        IValueHttpResult<TValue>
{
    internal FoundAtRoute(string? routeName, object? routeValues, TValue? value)
        : this(routeName, new RouteValueDictionary(routeValues), value) { }

    internal FoundAtRoute(string? routeName, RouteValueDictionary? routeValues, TValue? value)
    {
        RouteName = routeName;
        RouteValues = routeValues ?? new RouteValueDictionary();
        Value = value;
    }

    public string? RouteName { get; }

    public RouteValueDictionary RouteValues { get; }

    public TValue? Value { get; }

    object? IValueHttpResult.Value => Value;

    public int StatusCode => StatusCodes.Status200OK;

    int? IStatusCodeHttpResult.StatusCode => StatusCode;

    public Task ExecuteAsync(HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var path = FoundAtRoute.ResolveRelativePath(httpContext, RouteName, RouteValues);
        httpContext.Response.Headers.ContentLocation = path;
        httpContext.Response.StatusCode = StatusCode;
        return httpContext.Response.WriteAsJsonAsync(Value);
    }

    static void IEndpointMetadataProvider.PopulateMetadata(
        MethodInfo method,
        EndpointBuilder builder
    )
    {
        ArgumentNullException.ThrowIfNull(method);
        ArgumentNullException.ThrowIfNull(builder);

        builder.Metadata.Add(
            new ProducesResponseTypeMetadata(
                StatusCodes.Status200OK,
                typeof(TValue),
                ["application/json"]
            )
        );
    }
}
