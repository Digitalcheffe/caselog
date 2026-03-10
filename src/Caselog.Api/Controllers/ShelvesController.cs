using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/shelves")]
public sealed class ShelvesController(CaselogDbContext dbContext) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ShelfResponse>>>> GetShelves([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.Shelves
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Name);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ShelfResponse(x.Id, x.Name, x.Description, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<ShelfResponse>>(new PagedResult<ShelfResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ShelfResponse>>> GetShelf(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var shelf = await dbContext.Shelves.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (shelf is null)
        {
            return NotFoundProblem($"Shelf '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<ShelfResponse>(new ShelfResponse(shelf.Id, shelf.Name, shelf.Description, shelf.CreatedAt, shelf.UpdatedAt)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<ShelfResponse>>> CreateShelf([FromBody] ShelfRequest request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var shelf = new Shelf
        {
            Id = Guid.NewGuid(),
            UserId = GetUserId(),
            Name = request.Name.Trim(),
            Description = request.Description,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Shelves.Add(shelf);
        await dbContext.SaveChangesAsync(cancellationToken);

        var response = new ShelfResponse(shelf.Id, shelf.Name, shelf.Description, shelf.CreatedAt, shelf.UpdatedAt);
        return CreatedAtAction(nameof(GetShelf), new { id = shelf.Id }, new ApiEnvelope<ShelfResponse>(response));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ShelfResponse>>> UpdateShelf(Guid id, [FromBody] ShelfRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var shelf = await dbContext.Shelves.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (shelf is null)
        {
            return NotFoundProblem($"Shelf '{id}' was not found.");
        }

        shelf.Name = request.Name.Trim();
        shelf.Description = request.Description;
        shelf.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<ShelfResponse>(new ShelfResponse(shelf.Id, shelf.Name, shelf.Description, shelf.CreatedAt, shelf.UpdatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteShelf(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var shelf = await dbContext.Shelves.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (shelf is null)
        {
            return NotFoundProblem($"Shelf '{id}' was not found.");
        }

        dbContext.Shelves.Remove(shelf);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("{id:guid}/notebooks")]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NotebookResponse>>>> GetShelfNotebooks(Guid id, [FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var shelfExists = await dbContext.Shelves.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!shelfExists)
        {
            return NotFoundProblem($"Shelf '{id}' was not found.");
        }

        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;
        var baseQuery = dbContext.Notebooks.AsNoTracking().Where(x => x.UserId == userId && x.ShelfId == id).OrderBy(x => x.Name);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new NotebookResponse(x.Id, x.ShelfId, x.Name, x.Description, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<NotebookResponse>>(new PagedResult<NotebookResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }
}
