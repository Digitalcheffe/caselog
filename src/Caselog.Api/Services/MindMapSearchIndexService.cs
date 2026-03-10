using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class MindMapSearchIndexService(CaselogDbContext dbContext)
{
    public async Task UpsertAsync(Guid mindMapId, CancellationToken cancellationToken)
    {
        var mindMap = await dbContext.MindMaps.AsNoTracking().SingleOrDefaultAsync(x => x.Id == mindMapId, cancellationToken);
        if (mindMap is null)
        {
            await DeleteAsync(mindMapId, cancellationToken);
            return;
        }

        var tags = await dbContext.EntityTags
            .Where(x => x.EntityType == "mindmap" && x.EntityId == mindMapId)
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (_, tag) => tag.Name)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        var labels = await dbContext.MindMapNodes
            .Where(x => x.MindMapId == mindMapId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Label)
            .Select(x => x.Label)
            .ToListAsync(cancellationToken);

        await DeleteAsync(mindMapId, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
            VALUES ('mindmap', {mindMapId.ToString()}, {mindMap.Title}, {string.Join(' ', labels)}, {string.Join(' ', tags)}, '')
            """, cancellationToken);
    }

    public async Task DeleteAsync(Guid mindMapId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM search_index
            WHERE entity_type = 'mindmap' AND entity_id = {mindMapId.ToString()}
            """, cancellationToken);
    }
}
