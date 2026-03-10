using Caselog.Api.Data;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/{entityType}/{id:guid}/tags")]
public sealed class EntityTagsController(CaselogDbContext dbContext, TaggingService taggingService, LogSearchIndexService pageSearchIndexService, MindMapSearchIndexService mindMapSearchIndexService) : BaseApiController
{
    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<string>>>> AddTags(string entityType, Guid id, [FromBody] TagRequest request, CancellationToken cancellationToken)
    {
        var normalizedEntityType = NormalizeEntityType(entityType);
        var userId = GetUserId();
        if (!await taggingService.EntityExistsForUserAsync(normalizedEntityType, id, userId, cancellationToken))
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var tagsToAdd = request.Tags ?? Array.Empty<string>();
        var addedTags = await taggingService.AddTagsAsync(normalizedEntityType, id, tagsToAdd, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await UpdateSearchIndexIfNeededAsync(normalizedEntityType, id, cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<string>>(addedTags));
    }

    [HttpDelete("{tag}")]
    public async Task<ActionResult<ApiEnvelope<object>>> RemoveTag(string entityType, Guid id, string tag, CancellationToken cancellationToken)
    {
        var normalizedEntityType = NormalizeEntityType(entityType);
        var userId = GetUserId();
        if (!await taggingService.EntityExistsForUserAsync(normalizedEntityType, id, userId, cancellationToken))
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var wasRemoved = await taggingService.RemoveTagAsync(normalizedEntityType, id, tag, cancellationToken);
        if (!wasRemoved)
        {
            return NotFoundProblem($"Tag '{tag}' was not found for entity '{normalizedEntityType}' with id '{id}'.");
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await UpdateSearchIndexIfNeededAsync(normalizedEntityType, id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    private static string NormalizeEntityType(string entityType)
    {
        return entityType.Trim().ToLowerInvariant();
    }

    private async Task UpdateSearchIndexIfNeededAsync(string entityType, Guid id, CancellationToken cancellationToken)
    {
        if (entityType == "log")
        {
            var log = await dbContext.Logs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (log is not null)
            {
                await pageSearchIndexService.UpsertAsync(log, cancellationToken);
            }

            return;
        }

        if (entityType == "mindmap")
        {
            await mindMapSearchIndexService.UpsertAsync(id, cancellationToken);
        }
    }
}
