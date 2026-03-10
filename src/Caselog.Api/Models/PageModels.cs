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

public sealed record PageAttachmentsResponse(
    IReadOnlyList<PageListAttachmentResponse> ListEntries,
    IReadOnlyList<PageMindMapAttachmentResponse> MindMaps);

public sealed record PageListAttachmentResponse(
    Guid AttachmentId,
    Guid ListEntryId,
    Guid ListTypeId,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record PageMindMapAttachmentResponse(
    Guid AttachmentId,
    Guid MindMapId,
    string Title,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record PageListAttachmentRequest(Guid ListEntryId, int? SortOrder);

public sealed record PageMindMapAttachmentRequest(Guid MindMapId, int? SortOrder);
