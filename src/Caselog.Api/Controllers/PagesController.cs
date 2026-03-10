using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/pages")]
public sealed class PagesController(CaselogDbContext dbContext, PageSearchIndexService searchIndexService, TaggingService taggingService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<PageResponse>>>> GetPages([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.Pages.AsNoTracking().Where(x => x.UserId == userId).OrderBy(x => x.Title);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new PageResponse(x.Id, x.NotebookId, x.Title, x.Content, x.Visibility, x.PublicSlug, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<PageResponse>>(new PagedResult<PageResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<PageResponse>>> GetPage(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = await dbContext.Pages.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (page is null)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<PageResponse>(new PageResponse(page.Id, page.NotebookId, page.Title, page.Content, page.Visibility, page.PublicSlug, page.CreatedAt, page.UpdatedAt)));
    }

    [HttpGet("{id:guid}/attachments")]
    public async Task<ActionResult<ApiEnvelope<PageAttachmentsResponse>>> GetAttachments(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        var listEntries = await dbContext.PageListAttachments.AsNoTracking()
            .Where(x => x.PageId == id && x.Page.UserId == userId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new PageListAttachmentResponse(
                x.Id,
                x.ListEntryId,
                x.ListEntry.ListTypeId,
                x.SortOrder,
                x.ListEntry.CreatedAt,
                x.ListEntry.UpdatedAt))
            .ToListAsync(cancellationToken);

        var mindMaps = await dbContext.PageMindMapAttachments.AsNoTracking()
            .Where(x => x.PageId == id && x.Page.UserId == userId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new PageMindMapAttachmentResponse(
                x.Id,
                x.MindMapId,
                x.MindMap.Title,
                x.SortOrder,
                x.MindMap.CreatedAt,
                x.MindMap.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PageAttachmentsResponse>(new PageAttachmentsResponse(listEntries, mindMaps)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<PageResponse>>> CreatePage([FromBody] PageRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (request.NotebookId.HasValue)
        {
            var notebookExists = await dbContext.Notebooks.AsNoTracking().AnyAsync(x => x.Id == request.NotebookId.Value && x.UserId == userId, cancellationToken);
            if (!notebookExists)
            {
                return NotFoundProblem($"Notebook '{request.NotebookId.Value}' was not found.");
            }
        }

        var now = DateTime.UtcNow;
        var page = new Page
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            NotebookId = request.NotebookId,
            Title = request.Title.Trim(),
            Content = request.Content,
            Visibility = request.Visibility,
            PublicSlug = request.PublicSlug,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Pages.Add(page);
        await taggingService.AddTagsAsync("page", page.Id, ["type:page", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.UpsertAsync(page, cancellationToken);

        return CreatedAtAction(nameof(GetPage), new { id = page.Id }, new ApiEnvelope<PageResponse>(new PageResponse(page.Id, page.NotebookId, page.Title, page.Content, page.Visibility, page.PublicSlug, page.CreatedAt, page.UpdatedAt)));
    }

    [HttpPost("{id:guid}/lists")]
    public async Task<ActionResult<ApiEnvelope<PageListAttachmentResponse>>> AttachListEntry(Guid id, [FromBody] PageListAttachmentRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        var listEntry = await dbContext.ListEntries.AsNoTracking()
            .Where(x => x.Id == request.ListEntryId && x.UserId == userId)
            .Select(x => new { x.Id, x.ListTypeId, x.CreatedAt, x.UpdatedAt })
            .SingleOrDefaultAsync(cancellationToken);
        if (listEntry is null)
        {
            return NotFoundProblem($"Entry '{request.ListEntryId}' was not found.");
        }

        var existing = await dbContext.PageListAttachments.SingleOrDefaultAsync(x => x.PageId == id && x.ListEntryId == request.ListEntryId, cancellationToken);
        if (existing is not null)
        {
            return Ok(new ApiEnvelope<PageListAttachmentResponse>(
                new PageListAttachmentResponse(existing.Id, existing.ListEntryId, listEntry.ListTypeId, existing.SortOrder, listEntry.CreatedAt, listEntry.UpdatedAt)));
        }

        var sortOrder = request.SortOrder ?? await dbContext.PageListAttachments
            .Where(x => x.PageId == id)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        var attachment = new PageListAttachment
        {
            Id = Guid.NewGuid(),
            PageId = id,
            ListEntryId = request.ListEntryId,
            SortOrder = sortOrder
        };

        dbContext.PageListAttachments.Add(attachment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<PageListAttachmentResponse>(
            new PageListAttachmentResponse(attachment.Id, attachment.ListEntryId, listEntry.ListTypeId, attachment.SortOrder, listEntry.CreatedAt, listEntry.UpdatedAt)));
    }

    [HttpDelete("{id:guid}/lists")]
    public async Task<ActionResult<ApiEnvelope<object>>> DetachListEntry(Guid id, [FromBody] PageListAttachmentRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        var attachment = await dbContext.PageListAttachments.SingleOrDefaultAsync(x => x.PageId == id && x.ListEntryId == request.ListEntryId, cancellationToken);
        if (attachment is null)
        {
            return NotFoundProblem($"Entry '{request.ListEntryId}' is not attached to page '{id}'.");
        }

        dbContext.PageListAttachments.Remove(attachment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpPost("{id:guid}/mindmaps")]
    public async Task<ActionResult<ApiEnvelope<PageMindMapAttachmentResponse>>> AttachMindMap(Guid id, [FromBody] PageMindMapAttachmentRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        var mindMap = await dbContext.MindMaps.AsNoTracking()
            .Where(x => x.Id == request.MindMapId && x.UserId == userId)
            .Select(x => new { x.Id, x.Title, x.CreatedAt, x.UpdatedAt })
            .SingleOrDefaultAsync(cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{request.MindMapId}' was not found.");
        }

        var existing = await dbContext.PageMindMapAttachments.SingleOrDefaultAsync(x => x.PageId == id && x.MindMapId == request.MindMapId, cancellationToken);
        if (existing is not null)
        {
            return Ok(new ApiEnvelope<PageMindMapAttachmentResponse>(
                new PageMindMapAttachmentResponse(existing.Id, existing.MindMapId, mindMap.Title, existing.SortOrder, mindMap.CreatedAt, mindMap.UpdatedAt)));
        }

        var sortOrder = request.SortOrder ?? await dbContext.PageMindMapAttachments
            .Where(x => x.PageId == id)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        var attachment = new PageMindMapAttachment
        {
            Id = Guid.NewGuid(),
            PageId = id,
            MindMapId = request.MindMapId,
            SortOrder = sortOrder
        };

        dbContext.PageMindMapAttachments.Add(attachment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<PageMindMapAttachmentResponse>(
            new PageMindMapAttachmentResponse(attachment.Id, attachment.MindMapId, mindMap.Title, attachment.SortOrder, mindMap.CreatedAt, mindMap.UpdatedAt)));
    }

    [HttpDelete("{id:guid}/mindmaps")]
    public async Task<ActionResult<ApiEnvelope<object>>> DetachMindMap(Guid id, [FromBody] PageMindMapAttachmentRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pageExists = await dbContext.Pages.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!pageExists)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        var attachment = await dbContext.PageMindMapAttachments.SingleOrDefaultAsync(x => x.PageId == id && x.MindMapId == request.MindMapId, cancellationToken);
        if (attachment is null)
        {
            return NotFoundProblem($"Mind map '{request.MindMapId}' is not attached to page '{id}'.");
        }

        dbContext.PageMindMapAttachments.Remove(attachment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<PageResponse>>> UpdatePage(Guid id, [FromBody] PageRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = await dbContext.Pages.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (page is null)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        if (request.NotebookId.HasValue)
        {
            var notebookExists = await dbContext.Notebooks.AsNoTracking().AnyAsync(x => x.Id == request.NotebookId.Value && x.UserId == userId, cancellationToken);
            if (!notebookExists)
            {
                return NotFoundProblem($"Notebook '{request.NotebookId.Value}' was not found.");
            }
        }

        page.NotebookId = request.NotebookId;
        page.Title = request.Title.Trim();
        page.Content = request.Content;
        page.Visibility = request.Visibility;
        page.PublicSlug = request.PublicSlug;
        page.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.UpsertAsync(page, cancellationToken);

        return Ok(new ApiEnvelope<PageResponse>(new PageResponse(page.Id, page.NotebookId, page.Title, page.Content, page.Visibility, page.PublicSlug, page.CreatedAt, page.UpdatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeletePage(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = await dbContext.Pages.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (page is null)
        {
            return NotFoundProblem($"Page '{id}' was not found.");
        }

        dbContext.Pages.Remove(page);
        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.DeleteAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }
}
