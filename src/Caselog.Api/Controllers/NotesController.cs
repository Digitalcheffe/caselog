using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api")]
public sealed class NotesController(CaselogDbContext dbContext, NoteSearchIndexService noteSearchIndexService) : BaseApiController
{
    [HttpGet("notes")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NoteResponse>>>> GetNotes([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.Notes.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.UpdatedAt);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(MapToResponse())
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<NoteResponse>>(new PagedResult<NoteResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("notes/{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<NoteResponse>>> GetNote(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var note = await dbContext.Notes.AsNoTracking().Where(x => x.Id == id && x.UserId == userId).Select(MapToResponse()).SingleOrDefaultAsync(cancellationToken);
        if (note is null)
        {
            return NotFoundProblem($"Note '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<NoteResponse>(note));
    }

    [HttpPost("notes")]
    public async Task<ActionResult<ApiEnvelope<NoteResponse>>> CreateNote([FromBody] NoteRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var validationError = await ValidateAttachmentAsync(request.EntityType, request.EntityId, userId, cancellationToken);
        if (validationError is not null)
        {
            return validationError;
        }

        var now = DateTime.UtcNow;
        var note = new Note
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            EntityType = NormalizeEntityType(request.EntityType),
            EntityId = request.EntityId,
            Content = request.Content,
            Visibility = request.Visibility,
            PublicSlug = request.PublicSlug,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Notes.Add(note);
        await dbContext.SaveChangesAsync(cancellationToken);
        await noteSearchIndexService.UpsertAsync(note, cancellationToken);

        return CreatedAtAction(nameof(GetNote), new { id = note.Id }, new ApiEnvelope<NoteResponse>(ToResponse(note)));
    }

    [HttpPut("notes/{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<NoteResponse>>> UpdateNote(Guid id, [FromBody] NoteRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var note = await dbContext.Notes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (note is null)
        {
            return NotFoundProblem($"Note '{id}' was not found.");
        }

        var validationError = await ValidateAttachmentAsync(request.EntityType, request.EntityId, userId, cancellationToken);
        if (validationError is not null)
        {
            return validationError;
        }

        note.EntityType = NormalizeEntityType(request.EntityType);
        note.EntityId = request.EntityId;
        note.Content = request.Content;
        note.Visibility = request.Visibility;
        note.PublicSlug = request.PublicSlug;
        note.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await noteSearchIndexService.UpsertAsync(note, cancellationToken);

        return Ok(new ApiEnvelope<NoteResponse>(ToResponse(note)));
    }

    [HttpDelete("notes/{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteNote(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var note = await dbContext.Notes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (note is null)
        {
            return NotFoundProblem($"Note '{id}' was not found.");
        }

        dbContext.Notes.Remove(note);
        await dbContext.SaveChangesAsync(cancellationToken);
        await noteSearchIndexService.DeleteAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("pages/{id:guid}/notes")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NoteResponse>>>> GetPageNotes(Guid id, [FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        return await GetAttachedNotesAsync("page", id, userId, query, cancellationToken);
    }

    [HttpGet("entries/{id:guid}/notes")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NoteResponse>>>> GetEntryNotes(Guid id, [FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var entryExists = await dbContext.ListEntries.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!entryExists)
        {
            return NotFoundProblem($"Entry '{id}' was not found.");
        }

        return await GetAttachedNotesAsync("listentry", id, userId, query, cancellationToken);
    }

    private async Task<ActionResult<ApiEnvelope<PagedResult<NoteResponse>>>> GetAttachedNotesAsync(string entityType, Guid entityId, Guid userId, PaginationQuery query, CancellationToken cancellationToken)
    {
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.Notes.AsNoTracking()
            .Where(x => x.UserId == userId && x.EntityType == entityType && x.EntityId == entityId)
            .OrderByDescending(x => x.UpdatedAt);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(MapToResponse())
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<NoteResponse>>(new PagedResult<NoteResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    private async Task<ActionResult?> ValidateAttachmentAsync(string? entityType, Guid? entityId, Guid userId, CancellationToken cancellationToken)
    {
        var normalizedEntityType = NormalizeEntityType(entityType);
        if (normalizedEntityType is null && entityId is null)
        {
            return null;
        }

        if (normalizedEntityType is null || !entityId.HasValue)
        {
            return ValidationProblem(new Dictionary<string, string[]>
            {
                ["entityType"] = ["entityType and entityId must both be provided when attaching a note."],
                ["entityId"] = ["entityType and entityId must both be provided when attaching a note."]
            });
        }

        var exists = normalizedEntityType switch
        {
            "page" => await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "listentry" => await dbContext.ListEntries.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "list" => await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "mindmap" => await dbContext.MindMaps.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "note" => await dbContext.Notes.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "notebook" => await dbContext.Notebooks.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            "shelf" => await dbContext.Shelves.AsNoTracking().AnyAsync(x => x.Id == entityId.Value && x.UserId == userId, cancellationToken),
            _ => false
        };

        if (!exists)
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{entityId.Value}' was not found.");
        }

        return null;
    }

    private static string? NormalizeEntityType(string? entityType)
    {
        return string.IsNullOrWhiteSpace(entityType) ? null : entityType.Trim().ToLowerInvariant();
    }

    private static System.Linq.Expressions.Expression<Func<Note, NoteResponse>> MapToResponse() =>
        x => new NoteResponse(x.Id, x.EntityType, x.EntityId, x.Content, x.Visibility, x.PublicSlug, x.CreatedAt, x.UpdatedAt);

    private static NoteResponse ToResponse(Note note) =>
        new(note.Id, note.EntityType, note.EntityId, note.Content, note.Visibility, note.PublicSlug, note.CreatedAt, note.UpdatedAt);
}
