namespace Caselog.Api.Models;

public sealed record SearchResultItem(
    string EntityType,
    Guid EntityId,
    string Title,
    string Snippet,
    IReadOnlyList<string> Tags,
    string? Location,
    DateTime CreatedAt);

public sealed record SearchResponse(
    IReadOnlyList<SearchResultItem> Items,
    PaginationMeta Pagination,
    string? ParsedQuery = null);
