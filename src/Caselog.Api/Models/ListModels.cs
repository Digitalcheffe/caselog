using System.Text.Json;
using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record ListTypeRequest(string Name, string? Description, Visibility Visibility, string? PublicSlug);

public sealed record ListTypeResponse(
    Guid Id,
    string Name,
    string? Description,
    Visibility Visibility,
    string? PublicSlug,
    DateTime CreatedAt);

public sealed record ListTypeFieldRequest(string FieldName, ListFieldType FieldType, bool Required, int SortOrder);

public sealed record ListTypeFieldResponse(Guid Id, Guid ListTypeId, string FieldName, ListFieldType FieldType, bool Required, int SortOrder);

public sealed record ListEntryRequest(Dictionary<Guid, JsonElement?> Values);

public sealed record ListEntryFieldValueResponse(
    Guid FieldId,
    string FieldName,
    ListFieldType FieldType,
    bool Required,
    int SortOrder,
    JsonElement? Value);

public sealed record ListEntryResponse(Guid Id, Guid ListTypeId, DateTime CreatedAt, DateTime UpdatedAt, IReadOnlyList<ListEntryFieldValueResponse> Values);
