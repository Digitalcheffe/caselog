using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record PublishRequest(Visibility Visibility, string? PublicSlug);
public sealed record PublishResponse(string Type, Guid Id, Visibility Visibility, string? PublicSlug);
public sealed record PublicItemResponse(string Type, Guid Id, string Title, string Content);
