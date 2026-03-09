using System.Security.Claims;
using System.Text.Encodings.Web;
using Caselog.Api.Data;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Caselog.Api.Authentication;

public class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    CaselogDbContext dbContext) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var authorizationHeaderValues))
        {
            return AuthenticateResult.Fail("Missing Authorization header.");
        }

        var authorizationHeader = authorizationHeaderValues.ToString().Trim();
        const string bearerPrefix = "Bearer ";
        if (!authorizationHeader.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.Fail("Invalid Authorization header format.");
        }

        var apiKey = authorizationHeader[bearerPrefix.Length..].Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return AuthenticateResult.Fail("Missing API key token.");
        }

        var keyHash = ApiKeyHasher.Hash(apiKey);

        var matchedKey = await dbContext.UserApiKeys
            .AsNoTracking()
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.KeyHash == keyHash, Context.RequestAborted);

        if (matchedKey is null)
        {
            return AuthenticateResult.Fail("Invalid API key.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, matchedKey.UserId.ToString()),
            new(ClaimTypes.Email, matchedKey.User.Email),
            new(ClaimTypes.Role, matchedKey.User.Role.ToString()),
            new("api_key_id", matchedKey.Id.ToString())
        };

        var identity = new ClaimsIdentity(claims, ApiKeyAuthenticationDefaults.Scheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, ApiKeyAuthenticationDefaults.Scheme);

        return AuthenticateResult.Success(ticket);
    }
}
