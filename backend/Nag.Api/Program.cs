using FluentValidation;
using JasperFx.Events.Projections;
using Marten;
using Nag.Api.Auth;
using Nag.Api.Endpoints;
using Nag.Api.Infrastructure;
using Nag.Core.Contracts;
using Nag.Core.Handlers;
using Nag.Core.Projections;
using Nag.Core.Validation;
using Serilog;
using Wolverine;
using static Microsoft.AspNetCore.Http.Results;

#if DEBUG
dotenv.net.DotEnv.Load(
    new dotenv.net.DotEnvOptions(envFilePaths: [".env", ".env.local"], ignoreExceptions: true)
);
#endif

var builder = WebApplication.CreateBuilder(args);

LambdaSecrets.HydrateFromEnvironment(builder.Configuration);

builder.Host.UseSerilog(
    (ctx, lc) =>
        lc.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().WriteTo.Console() // new Serilog.Formatting.Json.JsonFormatter()
);

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddSingleton(NagJsonOptions.Default);
builder.Services.ConfigureHttpJsonOptions(opts =>
{
    foreach (var c in NagJsonOptions.Default.Converters)
        opts.SerializerOptions.Converters.Add(c);
    opts.SerializerOptions.DefaultIgnoreCondition = NagJsonOptions.Default.DefaultIgnoreCondition;
});

builder.Services.AddSingleton(TimeProvider.System);

var connectionString =
    builder.Configuration.GetConnectionString("Nag")
    ?? throw new InvalidOperationException("ConnectionStrings:Nag is not configured.");

var schemaName = builder.Configuration["Nag:SchemaName"];

builder.Services.AddMarten(opts =>
{
    opts.Connection(connectionString);
    if (!string.IsNullOrWhiteSpace(schemaName))
    {
        opts.DatabaseSchemaName = schemaName;
        opts.Events.DatabaseSchemaName = schemaName;
    }
    opts.Events.StreamIdentity = JasperFx.Events.StreamIdentity.AsGuid;

    foreach (var t in CommandRegistry.All)
    {
        opts.Events.AddEventType(t);
    }

    opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
});

builder.Host.UseWolverine(opts =>
{
    opts.Durability.Mode = DurabilityMode.Serverless;
    opts.Discovery.IncludeAssembly(typeof(CommandDispatcher).Assembly);
});

builder.Services.AddScoped<CommandDispatcher>();
builder.Services.AddScoped<CommandsReader>();

var clerkIssuer = builder.Configuration["Nag:ClerkIssuer"];
if (!string.IsNullOrWhiteSpace(clerkIssuer))
{
    builder.Services.Configure<ClerkOptions>(opts => opts.Issuer = clerkIssuer);
    builder.Services.AddHttpClient("clerk-jwks");
    builder.Services.AddSingleton<Microsoft.IdentityModel.Protocols.IConfigurationManager<Microsoft.IdentityModel.Protocols.OpenIdConnect.OpenIdConnectConfiguration>>(
        sp =>
        {
            var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient("clerk-jwks");
            var metadataAddress = $"{clerkIssuer.TrimEnd('/')}/.well-known/openid-configuration";
            return new Microsoft.IdentityModel.Protocols.ConfigurationManager<Microsoft.IdentityModel.Protocols.OpenIdConnect.OpenIdConnectConfiguration>(
                metadataAddress,
                new Microsoft.IdentityModel.Protocols.OpenIdConnect.OpenIdConnectConfigurationRetriever(),
                new Microsoft.IdentityModel.Protocols.HttpDocumentRetriever(http)
            );
        }
    );
    builder.Services.AddSingleton<IClerkTokenVerifier, ClerkTokenVerifier>();
}

builder.Services.AddValidatorsFromAssemblyContaining<CreateHabitValidator>(filter: result =>
    result.ValidatorType != typeof(ScheduleEntryValidator)
);

#if DEBUG
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.UseAllOfToExtendReferenceSchemas();
    c.SchemaFilter<EnumSchemaFilter>();
    c.DocumentFilter<CommandSchemasFilter>();
});
#endif

var app = builder.Build();

app.UseSerilogRequestLogging();

app.UseMiddleware<BearerKeyMiddleware>();

app.MapGet("/health", NoContent).WithTags("Health").Produces(StatusCodes.Status204NoContent);
app.MapCommandsEndpoints();
app.MapHomeBoardEndpoints();
app.MapDevicesEndpoints();
app.MapAccountsEndpoints();

#if DEBUG
app.UseSwagger();
app.UseSwaggerUI();
#endif

app.Run();

public partial class Program;
