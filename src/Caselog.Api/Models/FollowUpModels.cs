using System.Text.Json.Serialization;

namespace Caselog.Api.Models;

public sealed record FollowUpRequest(string Note);

public sealed record FollowUpResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("location")] string Location,
    [property: JsonPropertyName("follow_up_note")] string FollowUpNote,
    [property: JsonPropertyName("created_at")] DateTime CreatedAt,
    [property: JsonPropertyName("source")] string? Source);
