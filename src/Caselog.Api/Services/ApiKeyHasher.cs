using System.Security.Cryptography;
using System.Text;

namespace Caselog.Api.Services;

public static class ApiKeyHasher
{
    public static string Hash(string apiKey)
    {
        var apiKeyBytes = Encoding.UTF8.GetBytes(apiKey);
        var hashBytes = SHA256.HashData(apiKeyBytes);
        return Convert.ToHexString(hashBytes);
    }

    public static string GenerateApiKey()
    {
        Span<byte> randomBytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(randomBytes);
        return Convert.ToBase64String(randomBytes).TrimEnd('=');
    }
}
