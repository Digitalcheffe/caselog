using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class LogSearchIndexService(CaselogDbContext dbContext)
{
    public async Task UpsertAsync(Log log, CancellationToken cancellationToken)
    {
        var tags = await dbContext.EntityTags
            .Where(x => x.EntityType == "log" && x.EntityId == log.Id)
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (_, tag) => tag.Name)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        await DeleteAsync(log.Id, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
            VALUES ('log', {log.Id.ToString()}, {log.Title}, {log.Content}, {string.Join(' ', tags)}, '')
            """, cancellationToken);
    }

    public async Task DeleteAsync(Guid logId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM search_index
            WHERE entity_type = 'log' AND entity_id = {logId.ToString()}
            """, cancellationToken);
    }
}
