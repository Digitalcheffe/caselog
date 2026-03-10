namespace Caselog.Api.Models;

public sealed record ShelfRequest(string Name, string? Description);

public sealed record ShelfResponse(
    Guid Id,
    string Name,
    string? Description,
    DateTime CreatedAt,
    DateTime UpdatedAt);
