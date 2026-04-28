using System.IO.Compression;
using FluentValidation;
using JasperFx;
using JasperFx.CodeGeneration;
using JasperFx.Events.Projections;
using Marten;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Nag.Api.Auth;
using Nag.Api.Infrastructure;
using Nag.Core.Contracts;
using Nag.Core.Domain;
using Nag.Core.Handlers;
using Nag.Core.Idempotency;
using Nag.Core.Projections;
using Nag.Core.ReadModels;
using Nag.Core.Validation;
using Serilog;
using Wolverine;
using Wolverine.Http;
#if DEBUG
using Microsoft.OpenApi;
using Nag.Api.OpenApi;

dotenv.net.DotEnv.Load(
    new dotenv.net.DotEnvOptions(envFilePaths: [".env", ".env.local"], ignoreExceptions: true)
);
#endif

var builder = WebApplication.CreateBuilder(args);

LambdaSecrets.HydrateFromEnvironment(builder.Configuration);

// Sentry: read all options from the `Sentry` config section. DSN comes from
// `Sentry:Dsn` (env var `SENTRY_DSN` in Lambda, hydrated by LambdaSecrets);
// when unset, pass an empty string to start the SDK in disabled mode (the
// only opt-out the SDK accepts — null throws). This matters for the
// Swashbuckle CLI host that builds the spec without any deployment config.
builder.WebHost.UseSentry(o =>
{
    if (string.IsNullOrWhiteSpace(o.Dsn))
    {
        o.Dsn = string.Empty;
    }
    o.Environment ??= builder.Environment.EnvironmentName;
    // ASP.NET Core's pipeline is async, so events are queued on a
    // background worker. In Lambda the host is frozen between
    // invocations — flush the queue at the end of each request so we
    // don't lose events.
    o.FlushOnCompletedRequest = true;
});

builder.Host.UseSerilog(
    (ctx, lc) =>
        lc
            .ReadFrom.Configuration(ctx.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console() // new Serilog.Formatting.Json.JsonFormatter()
            .WriteTo.Sentry(s =>
            {
                // Piggy-back on the SDK already initialized by `UseSentry`
                // above. Without this, the sink calls `SentrySdk.Init`
                // itself and throws when no DSN is configured (e.g.
                // `dotnet swagger tofile` builds the host without one).
                s.InitializeSdk = false;
                // Warning+ becomes a Sentry event; Information+ rides along
                // as a breadcrumb on whatever event captures next.
                s.MinimumEventLevel = Serilog.Events.LogEventLevel.Warning;
                s.MinimumBreadcrumbLevel = Serilog.Events.LogEventLevel.Information;
            })
);

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddSingleton(NagJsonOptions.Default);
builder.Services.ConfigureHttpJsonOptions(opts =>
{
    foreach (var c in NagJsonOptions.Default.Converters)
        opts.SerializerOptions.Converters.Add(c);
    opts.SerializerOptions.DefaultIgnoreCondition = NagJsonOptions.Default.DefaultIgnoreCondition;
});

builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o =>
    o.Level = CompressionLevel.Fastest
);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

builder.Services.AddSingleton(TimeProvider.System);

var connectionString =
    builder.Configuration.GetConnectionString("Nag")
    ?? throw new InvalidOperationException("ConnectionStrings:Nag is not configured.");

var schemaName = builder.Configuration["Nag:SchemaName"];

builder
    .Services.AddMarten(opts =>
    {
        opts.Connection(connectionString);
        if (!string.IsNullOrWhiteSpace(schemaName))
        {
            opts.DatabaseSchemaName = schemaName;
            opts.Events.DatabaseSchemaName = schemaName;
        }
        opts.Events.StreamIdentity = JasperFx.Events.StreamIdentity.AsGuid;

        // Skip per-cold-start pg_catalog introspection in production. Schema
        // changes are applied out-of-band (one-shot migration), so the Lambda
        // can assume the schema already matches.
        if (builder.Environment.IsProduction())
        {
            opts.AutoCreateSchemaObjects = AutoCreate.None;
        }

        foreach (var t in CommandRegistry.All)
        {
            opts.Events.AddEventType(t);
        }

        // Register every document type the API stores or loads, so that
        // `db-apply` (which we run out-of-band; see `infra/src/migrations.ts`)
        // can plan their tables. With AutoCreate.None, Marten doesn't
        // auto-discover documents on first use, so any unregistered type
        // would 5xx with a missing-relation error.
        opts.Schema.For<Account>();
        opts.Schema.For<Device>();
        opts.Schema.For<ProcessedCommand>();
        opts.Schema.For<HomeBoard>();

        opts.Projections.Add<HomeBoardProjection>(ProjectionLifecycle.Inline);
    })
    .UseLightweightSessions();

builder.Host.UseWolverine(opts =>
{
    opts.Durability.Mode = DurabilityMode.Serverless;
    opts.Discovery.IncludeAssembly(typeof(CommandDispatcher).Assembly);

    // In production, load handler types pre-generated at build time
    // (via `codegen write`) rather than compiling them on first invocation.
    // Cuts several seconds off Lambda cold start. Dev/test still use the
    // default dynamic mode so unit tests don't need the pre-built assembly.
    if (builder.Environment.IsProduction())
    {
        opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
    }
});

builder.Services.AddWolverineHttp();

builder.Services.AddScoped<CommandDispatcher>();
builder.Services.AddScoped<CommandsReader>();
builder.Services.AddScoped<SyncCoordinator>();

// Clerk verifier — registered in both modes. When Nag:ClerkIssuer is unset
// (mobile-only deployments) we register a no-op that always 401s, so the
// auth handler can still construct without a missing dependency.
var clerkIssuer = builder.Configuration["Nag:ClerkIssuer"];
if (!string.IsNullOrWhiteSpace(clerkIssuer))
{
    builder.Services.Configure<ClerkOptions>(opts => opts.Issuer = clerkIssuer);
    builder.Services.AddHttpClient("clerk-jwks");
    builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(sp =>
    {
        var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient("clerk-jwks");
        var metadataAddress = $"{clerkIssuer.TrimEnd('/')}/.well-known/openid-configuration";
        return new ConfigurationManager<OpenIdConnectConfiguration>(
            metadataAddress,
            new OpenIdConnectConfigurationRetriever(),
            new HttpDocumentRetriever(http)
        );
    });
    builder.Services.AddSingleton<IClerkTokenVerifier, ClerkTokenVerifier>();
    builder.Services.AddHostedService<JwksWarmupService>();
}
else
{
    builder.Services.AddSingleton<IClerkTokenVerifier, NullClerkTokenVerifier>();
}

// Device-token issuance + validation (HMAC-signed envelope).
builder.Services.Configure<DeviceTokenOptions>(builder.Configuration.GetSection("Nag:DeviceToken"));
builder.Services.AddSingleton<DeviceTokenService>();
builder.Services.AddSingleton<IDeviceTokenIssuer>(sp =>
    sp.GetRequiredService<DeviceTokenService>()
);
builder.Services.AddSingleton<IDeviceTokenValidator>(sp =>
    sp.GetRequiredService<DeviceTokenService>()
);
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IDeviceAccountResolver, DeviceAccountResolver>();

// ASP.NET Core authentication: a single "Nag" scheme whose handler
// branches on the bearer token shape (HMAC device token vs. Clerk JWT).
builder
    .Services.AddAuthentication(NagAuthenticationOptions.SchemeName)
    .AddScheme<NagAuthenticationOptions, NagAuthenticationHandler>(
        NagAuthenticationOptions.SchemeName,
        _ => { }
    );
builder.Services.AddAuthorization(opts =>
{
    // Every endpoint requires authentication unless explicitly [AllowAnonymous].
    opts.FallbackPolicy = opts.DefaultPolicy;
});

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
    c.OperationFilter<AllowAnonymousSecurityFilter>();
    c.AddSecurityDefinition(
        "Bearer",
        new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "Token",
            In = ParameterLocation.Header,
            Name = "Authorization",
            Description =
                "Either a per-device HMAC token (issued at /devices/register, "
                + "/devices/pair, or /accounts/upgrade) or a Clerk JWT.",
        }
    );
    c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer", doc), new List<string>() },
    });
});
#endif

var app = builder.Build();

// Register Sentry's performance-monitoring middleware. Distributed-trace
// headers (`sentry-trace`, `baggage`) sent by the mobile client are picked
// up here so backend spans nest under the originating mobile transaction.
app.UseSentryTracing();

app.UseSerilogRequestLogging();

#if DEBUG
// Swagger middleware must run before UseAuthentication / UseAuthorization
// so the docs UI is reachable without a bearer. The injected script
// pre-authorizes the UI against /dev/token, so every "Try it out" runs
// with a real HMAC-signed dev bearer.
app.UseSwagger();
app.UseSwaggerUI(c => c.UseRequestInterceptor(SwaggerDevAuth.RequestInterceptorScript));
app.MapSwaggerDevAuth();
#endif

app.UseResponseCompression();

app.UseAuthentication();
app.UseAuthorization();

app.MapWolverineEndpoints(opts =>
{
    opts.TenantId.IsClaimTypeNamed(NagClaimTypes.AccountId);
    opts.TenantId.AssertExists();
});

// JasperFx command pipeline only when explicitly opted into via env var
// (set by scripts/package-lambda.sh for `codegen write` during deploy).
// We can't gate on `args.Length > 0` because Swashbuckle's `dotnet swagger
// tofile` passes its own CLI args to Main, which would route the OpenAPI
// snapshot generation through RunJasperFxCommands and short-circuit before
// the host's endpoints are introspectable.
if (Environment.GetEnvironmentVariable("NAG_RUN_JASPERFX_COMMANDS") == "1")
{
    Environment.Exit(app.RunJasperFxCommands(args).GetAwaiter().GetResult());
}

app.Run();

namespace Nag.Api
{
    public partial class Program;
}
