namespace Caselog.Api.Models;

public sealed record ApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, DateTime? LastUsedAt);

public sealed class CreateApiKeyRequest
{
    public string? Label { get; init; }

    public string EffectiveLabel => (Label ?? string.Empty).Trim();
}

public sealed record CreateApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, string Key);
