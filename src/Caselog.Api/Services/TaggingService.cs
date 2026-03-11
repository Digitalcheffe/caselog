using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Services;

public sealed class TaggingService(CaselogDbContext dbContext)
{
    public static string NormalizeTagName(string tag)
    {
        return tag.Trim().ToLowerInvariant();
    }

    public static IReadOnlyList<string> NormalizeTagNames(IEnumerable<string> tags)
    {
        return tags
            .Select(NormalizeTagName)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    public async Task<bool> EntityExistsForUserAsync(string entityType, Guid entityId, Guid userId, CancellationToken cancellationToken)
    {
        return entityType switch
        {
            "log" => await dbContext.Logs.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            "kase" => await dbContext.Kases.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            "list" => await dbContext.ListTypes.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            "listentry" => await dbContext.ListEntries.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            "mindmap" => await dbContext.MindMaps.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            "note" => await dbContext.Notes.AsNoTracking().AnyAsync(x => x.Id == entityId && x.UserId == userId, cancellationToken),
            _ => false
        };
    }

    public async Task<IReadOnlyList<string>> AddTagsAsync(string entityType, Guid entityId, IEnumerable<string> tagNames, CancellationToken cancellationToken)
    {
        var normalizedTagNames = NormalizeTagNames(tagNames);
        if (normalizedTagNames.Count == 0)
        {
            return Array.Empty<string>();
        }

        var existingTags = await dbContext.Tags
            .Where(x => normalizedTagNames.Contains(x.Name))
            .ToDictionaryAsync(x => x.Name, x => x, cancellationToken);

        var added = new List<string>();
        foreach (var normalizedTagName in normalizedTagNames)
        {
            if (!existingTags.TryGetValue(normalizedTagName, out var tag))
            {
                tag = new Tag
                {
                    Id = Guid.NewGuid(),
                    Name = normalizedTagName
                };

                dbContext.Tags.Add(tag);
                existingTags[normalizedTagName] = tag;
            }

            var entityTagExists = await dbContext.EntityTags
                .AnyAsync(x => x.EntityType == entityType && x.EntityId == entityId && x.TagId == tag.Id, cancellationToken);

            if (entityTagExists)
            {
                continue;
            }

            dbContext.EntityTags.Add(new EntityTag
            {
                EntityType = entityType,
                EntityId = entityId,
                TagId = tag.Id
            });

            added.Add(normalizedTagName);
        }

        return added;
    }

    public async Task<bool> RemoveTagAsync(string entityType, Guid entityId, string tagName, CancellationToken cancellationToken)
    {
        var normalizedTagName = NormalizeTagName(tagName);
        if (string.IsNullOrWhiteSpace(normalizedTagName))
        {
            return false;
        }

        var entityTag = await dbContext.EntityTags
            .Include(x => x.Tag)
            .SingleOrDefaultAsync(
                x => x.EntityType == entityType
                     && x.EntityId == entityId
                     && x.Tag.Name == normalizedTagName,
                cancellationToken);

        if (entityTag is null)
        {
            return false;
        }

        dbContext.EntityTags.Remove(entityTag);
        return true;
    }
}
