namespace Caselog.Api.Models;

public sealed record ApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, DateTime? LastUsedAt);
public sealed record CreateApiKeyRequest(string Label);
public sealed record CreateApiKeyResponse(Guid Id, string Label, DateTime CreatedAt, string Key);
