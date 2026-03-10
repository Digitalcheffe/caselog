using System.Text.Json;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/lists")]
public sealed class ListsController(CaselogDbContext dbContext, TaggingService taggingService, ListEntrySearchIndexService listEntrySearchIndexService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ListTypeResponse>>>> GetListTypes([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.ListTypes.AsNoTracking().Where(x => x.UserId == userId).OrderBy(x => x.Name);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ListTypeResponse(x.Id, x.Name, x.Description, x.Visibility, x.PublicSlug, x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<ListTypeResponse>>(new PagedResult<ListTypeResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ListTypeResponse>>> GetListType(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listType = await dbContext.ListTypes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (listType is null)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<ListTypeResponse>(new ListTypeResponse(listType.Id, listType.Name, listType.Description, listType.Visibility, listType.PublicSlug, listType.CreatedAt)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<ListTypeResponse>>> CreateListType([FromBody] ListTypeRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listType = new ListType
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = request.Name.Trim(),
            Description = request.Description,
            Visibility = request.Visibility,
            PublicSlug = request.PublicSlug,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ListTypes.Add(listType);
        await taggingService.AddTagsAsync("list", listType.Id, ["type:list", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetListType), new { id = listType.Id }, new ApiEnvelope<ListTypeResponse>(new ListTypeResponse(listType.Id, listType.Name, listType.Description, listType.Visibility, listType.PublicSlug, listType.CreatedAt)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ListTypeResponse>>> UpdateListType(Guid id, [FromBody] ListTypeRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listType = await dbContext.ListTypes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (listType is null)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        listType.Name = request.Name.Trim();
        listType.Description = request.Description;
        listType.Visibility = request.Visibility;
        listType.PublicSlug = request.PublicSlug;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<ListTypeResponse>(new ListTypeResponse(listType.Id, listType.Name, listType.Description, listType.Visibility, listType.PublicSlug, listType.CreatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteListType(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listType = await dbContext.ListTypes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (listType is null)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        dbContext.ListTypes.Remove(listType);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("{id:guid}/fields")]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<ListTypeFieldResponse>>>> GetFields(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var fields = await dbContext.ListTypeFields.AsNoTracking()
            .Where(x => x.ListTypeId == id)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.FieldName)
            .Select(x => new ListTypeFieldResponse(x.Id, x.ListTypeId, x.FieldName, x.FieldType, x.Required, x.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<ListTypeFieldResponse>>(fields));
    }

    [HttpPost("{id:guid}/fields")]
    public async Task<ActionResult<ApiEnvelope<ListTypeFieldResponse>>> CreateField(Guid id, [FromBody] ListTypeFieldRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var field = new ListTypeField
        {
            Id = Guid.NewGuid(),
            ListTypeId = id,
            FieldName = request.FieldName.Trim(),
            FieldType = request.FieldType,
            Required = request.Required,
            SortOrder = request.SortOrder
        };

        dbContext.ListTypeFields.Add(field);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetFields), new { id }, new ApiEnvelope<ListTypeFieldResponse>(new ListTypeFieldResponse(field.Id, field.ListTypeId, field.FieldName, field.FieldType, field.Required, field.SortOrder)));
    }

    [HttpPut("{id:guid}/fields/{fieldId:guid}")]
    public async Task<ActionResult<ApiEnvelope<ListTypeFieldResponse>>> UpdateField(Guid id, Guid fieldId, [FromBody] ListTypeFieldRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var field = await dbContext.ListTypeFields.SingleOrDefaultAsync(x => x.Id == fieldId && x.ListTypeId == id, cancellationToken);
        if (field is null)
        {
            return NotFoundProblem($"Field '{fieldId}' was not found.");
        }

        field.FieldName = request.FieldName.Trim();
        field.FieldType = request.FieldType;
        field.Required = request.Required;
        field.SortOrder = request.SortOrder;

        await dbContext.SaveChangesAsync(cancellationToken);

        var entryIds = await dbContext.ListEntries.AsNoTracking().Where(x => x.ListTypeId == id).Select(x => x.Id).ToListAsync(cancellationToken);
        foreach (var entryId in entryIds)
        {
            await listEntrySearchIndexService.UpsertAsync(entryId, cancellationToken);
        }

        return Ok(new ApiEnvelope<ListTypeFieldResponse>(new ListTypeFieldResponse(field.Id, field.ListTypeId, field.FieldName, field.FieldType, field.Required, field.SortOrder)));
    }

    [HttpDelete("{id:guid}/fields/{fieldId:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteField(Guid id, Guid fieldId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var field = await dbContext.ListTypeFields.SingleOrDefaultAsync(x => x.Id == fieldId && x.ListTypeId == id, cancellationToken);
        if (field is null)
        {
            return NotFoundProblem($"Field '{fieldId}' was not found.");
        }

        dbContext.ListTypeFields.Remove(field);
        await dbContext.SaveChangesAsync(cancellationToken);

        var entryIds = await dbContext.ListEntries.AsNoTracking().Where(x => x.ListTypeId == id).Select(x => x.Id).ToListAsync(cancellationToken);
        foreach (var entryId in entryIds)
        {
            await listEntrySearchIndexService.UpsertAsync(entryId, cancellationToken);
        }

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("{id:guid}/entries")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ListEntryResponse>>>> GetEntries(Guid id, [FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;
        var totalCount = await dbContext.ListEntries.AsNoTracking().CountAsync(x => x.UserId == userId && x.ListTypeId == id, cancellationToken);

        var entries = await dbContext.ListEntries.AsNoTracking()
            .Where(x => x.UserId == userId && x.ListTypeId == id)
            .OrderByDescending(x => x.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new { x.Id, x.ListTypeId, x.CreatedAt, x.UpdatedAt })
            .ToListAsync(cancellationToken);

        var entryIds = entries.Select(x => x.Id).ToArray();
        var fields = await dbContext.ListTypeFields.AsNoTracking().Where(x => x.ListTypeId == id).OrderBy(x => x.SortOrder).ThenBy(x => x.FieldName).ToListAsync(cancellationToken);
        var values = await dbContext.ListEntryFieldValues.AsNoTracking()
            .Where(x => entryIds.Contains(x.ListEntryId))
            .ToListAsync(cancellationToken);

        var responses = entries.Select(entry => BuildEntryResponse(entry.Id, entry.ListTypeId, entry.CreatedAt, entry.UpdatedAt, fields, values)).ToList();
        return Ok(new ApiEnvelope<PagedResult<ListEntryResponse>>(new PagedResult<ListEntryResponse>(responses, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpPost("{id:guid}/entries")]
    public async Task<ActionResult<ApiEnvelope<ListEntryResponse>>> CreateEntry(Guid id, [FromBody] ListEntryRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var listTypeExists = await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!listTypeExists)
        {
            return NotFoundProblem($"List '{id}' was not found.");
        }

        var fields = await dbContext.ListTypeFields.AsNoTracking().Where(x => x.ListTypeId == id).OrderBy(x => x.SortOrder).ThenBy(x => x.FieldName).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var entry = new ListEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ListTypeId = id,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.ListEntries.Add(entry);

        var validationError = ValidateAndApplyValues(entry.Id, fields, request.Values ?? new Dictionary<Guid, JsonElement?>(), dbContext.ListEntryFieldValues);
        if (validationError is not null)
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["values"] = [validationError] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        await taggingService.AddTagsAsync("listentry", entry.Id, ["type:listentry", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await listEntrySearchIndexService.UpsertAsync(entry.Id, cancellationToken);

        var createdValues = await dbContext.ListEntryFieldValues.AsNoTracking().Where(x => x.ListEntryId == entry.Id).ToListAsync(cancellationToken);
        var response = BuildEntryResponse(entry.Id, entry.ListTypeId, entry.CreatedAt, entry.UpdatedAt, fields, createdValues);
        return CreatedAtAction(nameof(EntriesController.GetEntry), "Entries", new { id = entry.Id }, new ApiEnvelope<ListEntryResponse>(response));
    }

    internal static string? ValidateAndApplyValues(Guid entryId, IReadOnlyList<ListTypeField> fields, Dictionary<Guid, JsonElement?> requestValues, DbSet<ListEntryFieldValue> targetSet)
    {
        var fieldLookup = fields.ToDictionary(x => x.Id, x => x);
        foreach (var key in requestValues.Keys)
        {
            if (!fieldLookup.ContainsKey(key))
            {
                return $"Field '{key}' does not belong to this list type.";
            }
        }

        foreach (var field in fields)
        {
            requestValues.TryGetValue(field.Id, out var element);
            var hasValue = element.HasValue;
            var elementValue = hasValue ? element.GetValueOrDefault() : default;
            if (field.Required && (!hasValue || elementValue.ValueKind == JsonValueKind.Null))
            {
                return $"Field '{field.FieldName}' is required.";
            }

            if (!hasValue || elementValue.ValueKind == JsonValueKind.Null)
            {
                continue;
            }

            if (!IsValidForType(field.FieldType, elementValue))
            {
                return $"Field '{field.FieldName}' expects value type '{field.FieldType}'.";
            }

            targetSet.Add(new ListEntryFieldValue
            {
                Id = Guid.NewGuid(),
                ListEntryId = entryId,
                ListTypeFieldId = field.Id,
                Value = elementValue.GetRawText()
            });
        }

        return null;
    }

    private static bool IsValidForType(ListFieldType fieldType, JsonElement value)
    {
        return fieldType switch
        {
            ListFieldType.Text => value.ValueKind == JsonValueKind.String,
            ListFieldType.Number => value.ValueKind == JsonValueKind.Number,
            ListFieldType.Boolean => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
            ListFieldType.Date => value.ValueKind == JsonValueKind.String && DateTime.TryParse(value.GetString(), out _),
            ListFieldType.Select => value.ValueKind == JsonValueKind.String,
            _ => false
        };
    }

    internal static ListEntryResponse BuildEntryResponse(
        Guid entryId,
        Guid listTypeId,
        DateTime createdAt,
        DateTime updatedAt,
        IReadOnlyList<ListTypeField> fields,
        IReadOnlyList<ListEntryFieldValue> values)
    {
        var valueLookup = values
            .Where(x => x.ListEntryId == entryId)
            .ToDictionary(x => x.ListTypeFieldId, x => x.Value);
        var responseValues = fields
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.FieldName)
            .Select(field => new ListEntryFieldValueResponse(
                field.Id,
                field.FieldName,
                field.FieldType,
                field.Required,
                field.SortOrder,
                valueLookup.TryGetValue(field.Id, out var value)
                    ? JsonSerializer.Deserialize<JsonElement>(value)
                    : null))
            .ToList();

        return new ListEntryResponse(entryId, listTypeId, createdAt, updatedAt, responseValues);
    }
}
