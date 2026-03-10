namespace Caselog.Api.Models;

public sealed record NotebookRequest(Guid? ShelfId, string Name, string? Description);

public sealed record NotebookResponse(
    Guid Id,
    Guid? ShelfId,
    string Name,
    string? Description,
    DateTime CreatedAt,
    DateTime UpdatedAt);
