using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed class MindMapRequest
{
    public string? Title { get; init; }
    public Visibility? Visibility { get; init; }
    public string? PublicSlug { get; init; }
}

public sealed record MindMapResponse(
    Guid Id,
    string Title,
    Visibility Visibility,
    string? PublicSlug,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record MindMapNodeRequest(Guid? ParentNodeId, string Label, string? Notes, int SortOrder);

public sealed record MindMapNodeResponse(
    Guid Id,
    Guid MindMapId,
    Guid? ParentNodeId,
    string Label,
    string? Notes,
    int SortOrder,
    IReadOnlyList<MindMapNodeResponse> Children);

public sealed record MindMapDetailResponse(
    Guid Id,
    string Title,
    Visibility Visibility,
    string? PublicSlug,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    MindMapNodeResponse RootNode);

public sealed record MindMapExportResponse(Guid MindMapId, string Format, string Message);
