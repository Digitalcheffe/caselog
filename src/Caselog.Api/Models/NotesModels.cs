using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record NoteRequest(string? EntityType, Guid? EntityId, string Content, Visibility Visibility, string? PublicSlug);

public sealed record NoteResponse(
    Guid Id,
    string? EntityType,
    Guid? EntityId,
    string Content,
    Visibility Visibility,
    string? PublicSlug,
    DateTime CreatedAt,
    DateTime UpdatedAt);
