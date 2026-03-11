using System.Text.Json.Serialization;

namespace Caselog.Api.Models;

public sealed record ApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, DateTime? LastUsedAt);

public sealed class CreateApiKeyRequest
{
    public string? Label { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonIgnore]
    public string EffectiveLabel => (Label ?? Name ?? string.Empty).Trim();
}

public sealed record CreateApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, string Key);
