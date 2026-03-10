using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class ListEntrySearchIndexService(CaselogDbContext dbContext)
{
    public async Task UpsertAsync(Guid listEntryId, CancellationToken cancellationToken)
    {
        var listEntryData = await dbContext.ListEntries
            .Where(x => x.Id == listEntryId)
            .Select(x => new
            {
                x.Id,
                ListName = x.ListType.Name,
                Values = x.FieldValues
                    .Select(v => new { v.ListTypeField.FieldName, v.Value })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (listEntryData is null)
        {
            await DeleteAsync(listEntryId, cancellationToken);
            return;
        }

        var tags = await dbContext.EntityTags
            .Where(x => x.EntityType == "listentry" && x.EntityId == listEntryId)
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (_, tag) => tag.Name)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        var content = string.Join(' ', listEntryData.Values.Select(x => $"{x.FieldName}:{x.Value}"));

        await DeleteAsync(listEntryId, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
            VALUES ('listentry', {listEntryData.Id.ToString()}, {listEntryData.ListName}, {content}, {string.Join(' ', tags)}, '')
            """, cancellationToken);
    }

    public async Task DeleteAsync(Guid listEntryId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM search_index
            WHERE entity_type = 'listentry' AND entity_id = {listEntryId.ToString()}
            """, cancellationToken);
    }
}
