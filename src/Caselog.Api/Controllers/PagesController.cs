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
public sealed class PagesController(CaselogDbContext dbContext, PageSearchIndexService searchIndexService) : BaseApiController
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
        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.UpsertAsync(page, cancellationToken);

        return CreatedAtAction(nameof(GetPage), new { id = page.Id }, new ApiEnvelope<PageResponse>(new PageResponse(page.Id, page.NotebookId, page.Title, page.Content, page.Visibility, page.PublicSlug, page.CreatedAt, page.UpdatedAt)));
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
