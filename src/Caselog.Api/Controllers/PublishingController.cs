using System.Text.RegularExpressions;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api")]
public sealed class PublishingController(CaselogDbContext dbContext) : BaseApiController
{
    private static readonly Regex SlugRegex = new("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.Compiled);

    [HttpPost("{type}/{id:guid}/publish")]
    public Task<ActionResult<ApiEnvelope<PublishResponse>>> Publish(string type, Guid id, [FromBody] PublishRequest request, CancellationToken cancellationToken)
        => UpsertPublishState(type, id, request, cancellationToken);

    [HttpPut("{type}/{id:guid}/publish")]
    public Task<ActionResult<ApiEnvelope<PublishResponse>>> UpdatePublish(string type, Guid id, [FromBody] PublishRequest request, CancellationToken cancellationToken)
        => UpsertPublishState(type, id, request, cancellationToken);

    private async Task<ActionResult<ApiEnvelope<PublishResponse>>> UpsertPublishState(string type, Guid id, PublishRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var normalizedType = type.Trim().ToLowerInvariant();

        var slug = request.Visibility == Visibility.Public
            ? await BuildSlugAsync(normalizedType, request.PublicSlug, id, cancellationToken)
            : null;

        return normalizedType switch
        {
            "logs" or "log" => await UpdatePageAsync(id, userId, request.Visibility, slug, cancellationToken),
            "lists" or "list" => await UpdateListAsync(id, userId, request.Visibility, slug, cancellationToken),
            "notes" or "note" => await UpdateNoteAsync(id, userId, request.Visibility, slug, cancellationToken),
            "mindmaps" or "mindmap" => await UpdateMindMapAsync(id, userId, request.Visibility, slug, cancellationToken),
            _ => NotFoundProblem($"Unsupported publish type '{type}'.")
        };
    }

    private async Task<string> BuildSlugAsync(string type, string? requestedSlug, Guid entityId, CancellationToken cancellationToken)
    {
        var slug = string.IsNullOrWhiteSpace(requestedSlug)
            ? await GenerateSlugFromTitleAsync(type, entityId, cancellationToken)
            : requestedSlug.Trim().ToLowerInvariant();

        if (!SlugRegex.IsMatch(slug))
        {
            throw new BadHttpRequestException("Public slug must be URL-safe lowercase letters, numbers, and hyphens.");
        }

        var exists = await dbContext.Logs.AnyAsync(x => x.PublicSlug == slug && x.Id != entityId, cancellationToken)
            || await dbContext.ListTypes.AnyAsync(x => x.PublicSlug == slug && x.Id != entityId, cancellationToken)
            || await dbContext.Notes.AnyAsync(x => x.PublicSlug == slug && x.Id != entityId, cancellationToken)
            || await dbContext.MindMaps.AnyAsync(x => x.PublicSlug == slug && x.Id != entityId, cancellationToken);

        if (exists)
        {
            throw new BadHttpRequestException($"Public slug '{slug}' is already in use.");
        }

        return slug;
    }

    private async Task<string> GenerateSlugFromTitleAsync(string type, Guid entityId, CancellationToken cancellationToken)
    {
        var source = type switch
        {
            "logs" or "log" => await dbContext.Logs.Where(x => x.Id == entityId).Select(x => x.Title).SingleOrDefaultAsync(cancellationToken),
            "lists" or "list" => await dbContext.ListTypes.Where(x => x.Id == entityId).Select(x => x.Name).SingleOrDefaultAsync(cancellationToken),
            "notes" or "note" => await dbContext.Notes.Where(x => x.Id == entityId).Select(x => x.Content).SingleOrDefaultAsync(cancellationToken),
            "mindmaps" or "mindmap" => await dbContext.MindMaps.Where(x => x.Id == entityId).Select(x => x.Title).SingleOrDefaultAsync(cancellationToken),
            _ => null
        };

        if (string.IsNullOrWhiteSpace(source))
        {
            throw new BadHttpRequestException("Unable to auto-generate slug for entity.");
        }

        var baseSlug = Regex.Replace(source.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(baseSlug) ? $"item-{entityId:N}" : baseSlug;
    }

    private async Task<ActionResult<ApiEnvelope<PublishResponse>>> UpdatePageAsync(Guid id, Guid userId, Visibility visibility, string? slug, CancellationToken cancellationToken)
    {
        var log = await dbContext.Logs.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (log is null) return NotFoundProblem($"Log '{id}' was not found.");
        log.Visibility = visibility;
        log.PublicSlug = slug;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<PublishResponse>(new PublishResponse("log", id, visibility, slug)));
    }

    private async Task<ActionResult<ApiEnvelope<PublishResponse>>> UpdateListAsync(Guid id, Guid userId, Visibility visibility, string? slug, CancellationToken cancellationToken)
    {
        var item = await dbContext.ListTypes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (item is null) return NotFoundProblem($"List '{id}' was not found.");
        item.Visibility = visibility;
        item.PublicSlug = slug;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<PublishResponse>(new PublishResponse("list", id, visibility, slug)));
    }

    private async Task<ActionResult<ApiEnvelope<PublishResponse>>> UpdateNoteAsync(Guid id, Guid userId, Visibility visibility, string? slug, CancellationToken cancellationToken)
    {
        var item = await dbContext.Notes.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (item is null) return NotFoundProblem($"Note '{id}' was not found.");
        item.Visibility = visibility;
        item.PublicSlug = slug;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<PublishResponse>(new PublishResponse("note", id, visibility, slug)));
    }

    private async Task<ActionResult<ApiEnvelope<PublishResponse>>> UpdateMindMapAsync(Guid id, Guid userId, Visibility visibility, string? slug, CancellationToken cancellationToken)
    {
        var item = await dbContext.MindMaps.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (item is null) return NotFoundProblem($"Mind map '{id}' was not found.");
        item.Visibility = visibility;
        item.PublicSlug = slug;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<PublishResponse>(new PublishResponse("mindmap", id, visibility, slug)));
    }
}
