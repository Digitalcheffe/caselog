using Caselog.Api.Data;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/tags")]
public sealed class TagsController(CaselogDbContext dbContext) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<TagSummaryResponse>>>> GetTags(CancellationToken cancellationToken)
    {
        var userId = GetUserId();

        var tags = await dbContext.EntityTags
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (entityTag, tag) => new { entityTag.EntityType, entityTag.EntityId, tag.Name })
            .Where(x =>
                (x.EntityType == "page" && dbContext.Pages.Any(p => p.Id == x.EntityId && p.UserId == userId))
                || (x.EntityType == "shelf" && dbContext.Shelves.Any(s => s.Id == x.EntityId && s.UserId == userId))
                || (x.EntityType == "notebook" && dbContext.Notebooks.Any(n => n.Id == x.EntityId && n.UserId == userId))
                || (x.EntityType == "list" && dbContext.ListTypes.Any(l => l.Id == x.EntityId && l.UserId == userId))
                || (x.EntityType == "listentry" && dbContext.ListEntries.Any(le => le.Id == x.EntityId && le.UserId == userId))
                || (x.EntityType == "mindmap" && dbContext.MindMaps.Any(m => m.Id == x.EntityId && m.UserId == userId))
                || (x.EntityType == "note" && dbContext.Notes.Any(no => no.Id == x.EntityId && no.UserId == userId)))
            .GroupBy(x => x.Name)
            .Select(group => new TagSummaryResponse(group.Key, group.Count()))
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<TagSummaryResponse>>(tags));
    }

    [HttpGet("{name}/items")]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<TaggedEntityResponse>>>> GetTagItems(string name, CancellationToken cancellationToken)
    {
        var normalizedTagName = TaggingService.NormalizeTagName(name);
        if (string.IsNullOrWhiteSpace(normalizedTagName))
        {
            return Ok(new ApiEnvelope<IReadOnlyList<TaggedEntityResponse>>(Array.Empty<TaggedEntityResponse>()));
        }

        var userId = GetUserId();

        var items = await dbContext.EntityTags
            .Where(x => x.Tag.Name == normalizedTagName)
            .Select(x => new TaggedEntityResponse(x.EntityType, x.EntityId))
            .Where(x =>
                (x.EntityType == "page" && dbContext.Pages.Any(p => p.Id == x.EntityId && p.UserId == userId))
                || (x.EntityType == "shelf" && dbContext.Shelves.Any(s => s.Id == x.EntityId && s.UserId == userId))
                || (x.EntityType == "notebook" && dbContext.Notebooks.Any(n => n.Id == x.EntityId && n.UserId == userId))
                || (x.EntityType == "list" && dbContext.ListTypes.Any(l => l.Id == x.EntityId && l.UserId == userId))
                || (x.EntityType == "listentry" && dbContext.ListEntries.Any(le => le.Id == x.EntityId && le.UserId == userId))
                || (x.EntityType == "mindmap" && dbContext.MindMaps.Any(m => m.Id == x.EntityId && m.UserId == userId))
                || (x.EntityType == "note" && dbContext.Notes.Any(no => no.Id == x.EntityId && no.UserId == userId)))
            .OrderBy(x => x.EntityType)
            .ThenBy(x => x.EntityId)
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<TaggedEntityResponse>>(items));
    }
}
