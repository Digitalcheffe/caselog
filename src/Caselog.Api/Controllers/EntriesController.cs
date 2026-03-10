using Caselog.Api.Data;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/entries")]
public sealed class EntriesController(CaselogDbContext dbContext, ListEntrySearchIndexService listEntrySearchIndexService) : BaseApiController
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ListEntryResponse>>> GetEntry(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var entry = await dbContext.ListEntries.AsNoTracking()
            .Where(x => x.Id == id && x.UserId == userId)
            .Select(x => new { x.Id, x.ListTypeId, x.CreatedAt, x.UpdatedAt })
            .SingleOrDefaultAsync(cancellationToken);

        if (entry is null)
        {
            return NotFoundProblem($"Entry '{id}' was not found.");
        }

        var fields = await dbContext.ListTypeFields.AsNoTracking().Where(x => x.ListTypeId == entry.ListTypeId).OrderBy(x => x.SortOrder).ThenBy(x => x.FieldName).ToListAsync(cancellationToken);
        var values = await dbContext.ListEntryFieldValues.AsNoTracking().Where(x => x.ListEntryId == id).ToListAsync(cancellationToken);
        return Ok(new ApiEnvelope<ListEntryResponse>(ListsController.BuildEntryResponse(entry.Id, entry.ListTypeId, entry.CreatedAt, entry.UpdatedAt, fields, values)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<ListEntryResponse>>> UpdateEntry(Guid id, [FromBody] ListEntryRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var entry = await dbContext.ListEntries.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (entry is null)
        {
            return NotFoundProblem($"Entry '{id}' was not found.");
        }

        var fields = await dbContext.ListTypeFields.AsNoTracking().Where(x => x.ListTypeId == entry.ListTypeId).OrderBy(x => x.SortOrder).ThenBy(x => x.FieldName).ToListAsync(cancellationToken);

        dbContext.ListEntryFieldValues.RemoveRange(dbContext.ListEntryFieldValues.Where(x => x.ListEntryId == id));
        var validationError = ListsController.ValidateAndApplyValues(entry.Id, fields, request.Values ?? new Dictionary<Guid, System.Text.Json.JsonElement?>(), dbContext.ListEntryFieldValues);
        if (validationError is not null)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["values"] = [validationError] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        entry.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await listEntrySearchIndexService.UpsertAsync(entry.Id, cancellationToken);

        var values = await dbContext.ListEntryFieldValues.AsNoTracking().Where(x => x.ListEntryId == id).ToListAsync(cancellationToken);
        return Ok(new ApiEnvelope<ListEntryResponse>(ListsController.BuildEntryResponse(entry.Id, entry.ListTypeId, entry.CreatedAt, entry.UpdatedAt, fields, values)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteEntry(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var entry = await dbContext.ListEntries.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (entry is null)
        {
            return NotFoundProblem($"Entry '{id}' was not found.");
        }

        dbContext.ListEntries.Remove(entry);
        await dbContext.SaveChangesAsync(cancellationToken);
        await listEntrySearchIndexService.DeleteAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }
}
