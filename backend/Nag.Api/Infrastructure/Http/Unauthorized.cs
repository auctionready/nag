using System.Reflection;
using Microsoft.AspNetCore.Http.Metadata;

namespace Nag.Api.Infrastructure.Http;

public static class UnauthorizedResultsExtensions
{
    public static IResult Unauthorized<TValue>(this IResultExtensions _, TValue? value) =>
        new Unauthorized<TValue>(value);
}

/// <summary>
/// An <see cref="IResult"/> that writes <typeparamref name="TValue"/> as JSON and
/// returns 401 Unauthorized. The body type flows into the endpoint's
/// <c>ProducesResponseTypeMetadata</c> so it surfaces in the OpenAPI document
/// without an explicit <c>[ProducesResponseType]</c> attribute.
/// </summary>
public sealed class Unauthorized<TValue>
    : IResult,
        IEndpointMetadataProvider,
        IStatusCodeHttpResult,
        IValueHttpResult,
        IValueHttpResult<TValue>
{
    internal Unauthorized(TValue? value)
    {
        Value = value;
    }

    public TValue? Value { get; }

    object? IValueHttpResult.Value => Value;

    public int StatusCode => StatusCodes.Status401Unauthorized;

    int? IStatusCodeHttpResult.StatusCode => StatusCode;

    public Task ExecuteAsync(HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

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
                StatusCodes.Status401Unauthorized,
                typeof(TValue),
                ["application/json"]
            )
        );
    }
}
