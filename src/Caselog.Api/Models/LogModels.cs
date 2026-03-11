using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record CreateLogRequest(Guid? KaseId, string Title, string Content, Visibility Visibility, string? PublicSlug);
public sealed record UpdateLogRequest(Guid? KaseId, string Title, string Content, Visibility Visibility, string? PublicSlug, bool IsFollowUp, DateTime? FollowUpDueAt);
public sealed record LogResponse(Guid Id, Guid? KaseId, string Title, string Content, Visibility Visibility, string? PublicSlug, DateTime CreatedAt, DateTime UpdatedAt, bool IsFollowUp, DateTime? FollowUpDueAt);

public sealed record CreateKaseLogRequest(string Title, string? Content, Visibility? Visibility, string? PublicSlug);
