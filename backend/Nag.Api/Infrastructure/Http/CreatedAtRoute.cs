using System.Reflection;
using Microsoft.AspNetCore.Http.Metadata;

namespace Nag.Api.Infrastructure.Http;

public static class CreatedAtRouteResultsExtensions
{
    public static IResult CreatedAtRoute(
        this IResultExtensions _,
        string? routeName = null,
        object? routeValues = null
    ) => new CreatedAtRoute(routeName, routeValues);

    public static IResult CreatedAtRoute<TValue>(
        this IResultExtensions _,
        string? routeName,
        object? routeValues,
        TValue? value
    ) => new CreatedAtRoute<TValue>(routeName, routeValues, value);
}

/// <summary>
/// An <see cref="IResult"/> that on execution sets <c>Location</c> to the relative
/// path of a registered route and writes 201 Created. Mirrors
/// <see cref="Results.CreatedAtRoute(string?, object?)"/> but emits a relative path
/// rather than an absolute URL.
/// </summary>
public sealed class CreatedAtRoute : IResult, IEndpointMetadataProvider, IStatusCodeHttpResult
{
    internal CreatedAtRoute(string? routeName, object? routeValues)
        : this(routeName, new RouteValueDictionary(routeValues)) { }

    internal CreatedAtRoute(string? routeName, RouteValueDictionary? routeValues)
    {
        RouteName = routeName;
        RouteValues = routeValues ?? new RouteValueDictionary();
    }

    public string? RouteName { get; }

    public RouteValueDictionary RouteValues { get; }

    public int StatusCode => StatusCodes.Status201Created;

    int? IStatusCodeHttpResult.StatusCode => StatusCode;

    public Task ExecuteAsync(HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var path = FoundAtRoute.ResolveRelativePath(httpContext, RouteName, RouteValues);
        httpContext.Response.Headers.Location = path;
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
            new ProducesResponseTypeMetadata(StatusCodes.Status201Created, typeof(void))
        );
    }
}

/// <summary>
/// An <see cref="IResult"/> that on execution sets <c>Location</c> to the relative
/// path of a registered route, writes <typeparamref name="TValue"/> as JSON, and
/// returns 201 Created.
/// </summary>
public sealed class CreatedAtRoute<TValue>
    : IResult,
        IEndpointMetadataProvider,
        IStatusCodeHttpResult,
        IValueHttpResult,
        IValueHttpResult<TValue>
{
    internal CreatedAtRoute(string? routeName, object? routeValues, TValue? value)
        : this(routeName, new RouteValueDictionary(routeValues), value) { }

    internal CreatedAtRoute(string? routeName, RouteValueDictionary? routeValues, TValue? value)
    {
        RouteName = routeName;
        RouteValues = routeValues ?? new RouteValueDictionary();
        Value = value;
    }

    public string? RouteName { get; }

    public RouteValueDictionary RouteValues { get; }

    public TValue? Value { get; }

    object? IValueHttpResult.Value => Value;

    public int StatusCode => StatusCodes.Status201Created;

    int? IStatusCodeHttpResult.StatusCode => StatusCode;

    public Task ExecuteAsync(HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var path = FoundAtRoute.ResolveRelativePath(httpContext, RouteName, RouteValues);
        httpContext.Response.Headers.Location = path;
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
                StatusCodes.Status201Created,
                typeof(TValue),
                ["application/json"]
            )
        );
    }
}
