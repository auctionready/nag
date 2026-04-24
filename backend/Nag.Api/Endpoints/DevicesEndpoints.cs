using Marten;
using Nag.Core.Contracts;
using Nag.Core.Domain;

namespace Nag.Api.Endpoints;

public static class DevicesEndpoints
{
    public static void MapDevicesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/devices").WithTags("Devices");

        group
            .MapPost("/register", RegisterDevice)
            .Produces<RegisterDeviceResponse>()
            .Produces<ErrorResponse>(400, "application/json");
    }

    public static async Task<IResult> RegisterDevice(
        RegisterDeviceRequest request,
        IDocumentSession session,
        TimeProvider clock,
        CancellationToken ct
    )
    {
        if (request.DeviceId == Guid.Empty)
        {
            return Results.BadRequest(new ErrorResponse(["deviceId is required"]));
        }

        var existing = await session.LoadAsync<Device>(request.DeviceId, ct);
        if (existing is not null)
        {
            return Results.Ok(
                new RegisterDeviceResponse(
                    existing.AccountId,
                    existing.Id,
                    existing.RegisteredAt
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
            new RegisterDeviceResponse(account.Id, device.Id, device.RegisteredAt)
        );
    }
}
