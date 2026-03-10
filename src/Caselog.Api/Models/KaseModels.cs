namespace Caselog.Api.Models;

public sealed record CreateKaseRequest(string Name, string? Description);
public sealed record UpdateKaseRequest(string Name, string? Description);
public sealed record KaseResponse(Guid Id, string Name, string? Description, DateTime CreatedAt, DateTime UpdatedAt);
