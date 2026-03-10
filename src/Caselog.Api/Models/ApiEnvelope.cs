namespace Caselog.Api.Models;

public record ApiEnvelope<T>(T? Data, object? Error = null);

public sealed record PaginationMeta(int Page, int PageSize, int TotalCount, int TotalPages);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, PaginationMeta Pagination);
