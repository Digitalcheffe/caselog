namespace Caselog.Api.Models;

public sealed class PaginationQuery
{
    private const int MaxPageSize = 100;
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public int NormalizedPage => Page < 1 ? 1 : Page;
    public int NormalizedPageSize => PageSize < 1 ? 20 : PageSize > MaxPageSize ? MaxPageSize : PageSize;
}
