using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record PageRequest(Guid? NotebookId, string Title, string Content, Visibility Visibility, string? PublicSlug);

public sealed record PageResponse(
    Guid Id,
    Guid? NotebookId,
    string Title,
    string Content,
    Visibility Visibility,
    string? PublicSlug,
    DateTime CreatedAt,
    DateTime UpdatedAt);
