using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/notebooks")]
public sealed class NotebooksController(CaselogDbContext dbContext) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NotebookResponse>>>> GetNotebooks([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.Notebooks.AsNoTracking().Where(x => x.UserId == userId).OrderBy(x => x.Name);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new NotebookResponse(x.Id, x.ShelfId, x.Name, x.Description, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<NotebookResponse>>(new PagedResult<NotebookResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<NotebookResponse>>> GetNotebook(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notebook = await dbContext.Notebooks.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (notebook is null)
        {
            return NotFoundProblem($"Notebook '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<NotebookResponse>(new NotebookResponse(notebook.Id, notebook.ShelfId, notebook.Name, notebook.Description, notebook.CreatedAt, notebook.UpdatedAt)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<NotebookResponse>>> CreateNotebook([FromBody] NotebookRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (request.ShelfId.HasValue)
        {
            var shelfExists = await dbContext.Shelves.AsNoTracking().AnyAsync(x => x.Id == request.ShelfId.Value && x.UserId == userId, cancellationToken);
            if (!shelfExists)
            {
                return NotFoundProblem($"Shelf '{request.ShelfId.Value}' was not found.");
            }
        }

        var now = DateTime.UtcNow;
        var notebook = new Notebook
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShelfId = request.ShelfId,
            Name = request.Name.Trim(),
            Description = request.Description,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Notebooks.Add(notebook);
        await dbContext.SaveChangesAsync(cancellationToken);

        var response = new NotebookResponse(notebook.Id, notebook.ShelfId, notebook.Name, notebook.Description, notebook.CreatedAt, notebook.UpdatedAt);
        return CreatedAtAction(nameof(GetNotebook), new { id = notebook.Id }, new ApiEnvelope<NotebookResponse>(response));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<NotebookResponse>>> UpdateNotebook(Guid id, [FromBody] NotebookRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notebook = await dbContext.Notebooks.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (notebook is null)
        {
            return NotFoundProblem($"Notebook '{id}' was not found.");
        }

        if (request.ShelfId.HasValue)
        {
            var shelfExists = await dbContext.Shelves.AsNoTracking().AnyAsync(x => x.Id == request.ShelfId.Value && x.UserId == userId, cancellationToken);
            if (!shelfExists)
            {
                return NotFoundProblem($"Shelf '{request.ShelfId.Value}' was not found.");
            }
        }

        notebook.ShelfId = request.ShelfId;
        notebook.Name = request.Name.Trim();
        notebook.Description = request.Description;
        notebook.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<NotebookResponse>(new NotebookResponse(notebook.Id, notebook.ShelfId, notebook.Name, notebook.Description, notebook.CreatedAt, notebook.UpdatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteNotebook(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notebook = await dbContext.Notebooks.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (notebook is null)
        {
            return NotFoundProblem($"Notebook '{id}' was not found.");
        }

        dbContext.Notebooks.Remove(notebook);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("{id:guid}/pages")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<PageResponse>>>> GetNotebookPages(Guid id, [FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notebookExists = await dbContext.Notebooks.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!notebookExists)
        {
            return NotFoundProblem($"Notebook '{id}' was not found.");
        }

        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;
        var baseQuery = dbContext.Pages.AsNoTracking().Where(x => x.UserId == userId && x.NotebookId == id).OrderBy(x => x.Title);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new PageResponse(x.Id, x.NotebookId, x.Title, x.Content, x.Visibility, x.PublicSlug, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<PageResponse>>(new PagedResult<PageResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }
}
