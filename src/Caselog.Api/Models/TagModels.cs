namespace Caselog.Api.Models;

public sealed record TagRequest(IReadOnlyList<string> Tags);

public sealed record TagSummaryResponse(string Name, int UsageCount);

public sealed record TaggedEntityResponse(string EntityType, Guid EntityId);
