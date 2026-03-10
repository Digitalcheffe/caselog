using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class PageSearchIndexService(CaselogDbContext dbContext)
{
    public async Task UpsertAsync(Page page, CancellationToken cancellationToken)
    {
        var tags = await dbContext.EntityTags
            .Where(x => x.EntityType == "page" && x.EntityId == page.Id)
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (_, tag) => tag.Name)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        await DeleteAsync(page.Id, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
            VALUES ('page', {page.Id.ToString()}, {page.Title}, {page.Content}, {string.Join(' ', tags)}, '')
            """, cancellationToken);
    }

    public async Task DeleteAsync(Guid pageId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM search_index
            WHERE entity_type = 'page' AND entity_id = {pageId.ToString()}
            """, cancellationToken);
    }
}
