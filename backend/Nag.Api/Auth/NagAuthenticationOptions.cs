using Microsoft.AspNetCore.Authentication;

namespace Nag.Api.Auth;

public sealed class NagAuthenticationOptions : AuthenticationSchemeOptions
{
    public const string SchemeName = "Nag";
}
