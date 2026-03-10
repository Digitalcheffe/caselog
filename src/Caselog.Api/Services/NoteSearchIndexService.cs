using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class NoteSearchIndexService(CaselogDbContext dbContext)
{
    public async Task UpsertAsync(Note note, CancellationToken cancellationToken)
    {
        var tags = await dbContext.EntityTags
            .Where(x => x.EntityType == "note" && x.EntityId == note.Id)
            .Join(dbContext.Tags, entityTag => entityTag.TagId, tag => tag.Id, (_, tag) => tag.Name)
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        await DeleteAsync(note.Id, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
            VALUES ('note', {note.Id.ToString()}, '', {note.Content}, {string.Join(' ', tags)}, '')
            """, cancellationToken);
    }

    public async Task DeleteAsync(Guid noteId, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM search_index
            WHERE entity_type = 'note' AND entity_id = {noteId.ToString()}
            """, cancellationToken);
    }
}
