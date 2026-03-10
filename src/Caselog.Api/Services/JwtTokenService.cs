using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Caselog.Api.Data.Entities;
using Microsoft.IdentityModel.Tokens;

namespace Caselog.Api.Services;

public class JwtTokenService(IConfiguration configuration)
{
    private const string PartialPurpose = "2fa";

    public string CreateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("token_type", "access")
        };

        return CreateToken(claims, DateTime.UtcNow.AddHours(8));
    }

    public string CreatePartialTwoFactorToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("token_type", "partial"),
            new Claim("purpose", PartialPurpose)
        };

        return CreateToken(claims, DateTime.UtcNow.AddMinutes(5));
    }

    public ClaimsPrincipal? ValidatePartialTwoFactorToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, GetValidationParameters(), out _);
            var purpose = principal.FindFirst("purpose")?.Value;
            var tokenType = principal.FindFirst("token_type")?.Value;
            return purpose == PartialPurpose && tokenType == "partial" ? principal : null;
        }
        catch
        {
            return null;
        }
    }

    public SymmetricSecurityKey GetSigningKey()
    {
        var secret = configuration["CASELOG_JWT_SECRET"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            secret = "caselog-dev-insecure-secret-change-me-32chars";
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
    }

    public TokenValidationParameters GetValidationParameters()
    {
        return new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = GetSigningKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    }

    private string CreateToken(IEnumerable<Claim> claims, DateTime expiresAt)
    {
        var credentials = new SigningCredentials(GetSigningKey(), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
