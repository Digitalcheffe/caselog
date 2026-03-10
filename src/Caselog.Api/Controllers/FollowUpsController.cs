using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api")]
public sealed class FollowUpsController(CaselogDbContext dbContext, TaggingService taggingService) : BaseApiController
{
    [HttpGet("followups")]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<FollowUpResponse>>>> GetOpenFollowUps(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var followUps = await dbContext.FollowUps.AsNoTracking()
            .Where(x => x.UserId == userId && x.ClearedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var response = new List<FollowUpResponse>(followUps.Count);
        foreach (var followUp in followUps)
        {
            var entityDetails = await ResolveEntityDetailsAsync(followUp.EntityType, followUp.EntityId, userId, cancellationToken);
            if (entityDetails is not { } details)
            {
                continue;
            }

            var source = await ResolveSourceTagAsync(followUp.EntityType, followUp.EntityId, cancellationToken);
            response.Add(new FollowUpResponse(
                followUp.Id,
                details.Title,
                followUp.EntityType,
                details.Location,
                followUp.Note,
                followUp.CreatedAt,
                source));
        }

        return Ok(new ApiEnvelope<IReadOnlyList<FollowUpResponse>>(response));
    }

    [HttpPost("{entityType}/{id:guid}/followup")]
    public async Task<ActionResult<ApiEnvelope<FollowUpResponse>>> UpsertFollowUp(string entityType, Guid id, [FromBody] FollowUpRequest request, CancellationToken cancellationToken)
    {
        var normalizedEntityType = entityType.Trim().ToLowerInvariant();
        var userId = GetUserId();

        if (!await taggingService.EntityExistsForUserAsync(normalizedEntityType, id, userId, cancellationToken))
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var note = request.Note.Trim();
        if (string.IsNullOrWhiteSpace(note))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["note"] = ["A follow-up note is required."]
            })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var existingOpenFollowUp = await dbContext.FollowUps
            .Where(x => x.UserId == userId && x.EntityType == normalizedEntityType && x.EntityId == id && x.ClearedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingOpenFollowUp is null)
        {
            existingOpenFollowUp = new FollowUp
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = normalizedEntityType,
                EntityId = id,
                Note = note,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.FollowUps.Add(existingOpenFollowUp);
        }
        else
        {
            existingOpenFollowUp.Note = note;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var entityDetails = await ResolveEntityDetailsAsync(normalizedEntityType, id, userId, cancellationToken);
        if (entityDetails is not { } details)
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var source = await ResolveSourceTagAsync(normalizedEntityType, id, cancellationToken);
        return Ok(new ApiEnvelope<FollowUpResponse>(new FollowUpResponse(
            existingOpenFollowUp.Id,
            details.Title,
            normalizedEntityType,
            details.Location,
            existingOpenFollowUp.Note,
            existingOpenFollowUp.CreatedAt,
            source)));
    }

    [HttpDelete("{entityType}/{id:guid}/followup")]
    public async Task<ActionResult<ApiEnvelope<object>>> ClearFollowUp(string entityType, Guid id, CancellationToken cancellationToken)
    {
        var normalizedEntityType = entityType.Trim().ToLowerInvariant();
        var userId = GetUserId();

        if (!await taggingService.EntityExistsForUserAsync(normalizedEntityType, id, userId, cancellationToken))
        {
            return NotFoundProblem($"Entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var openFollowUps = await dbContext.FollowUps
            .Where(x => x.UserId == userId && x.EntityType == normalizedEntityType && x.EntityId == id && x.ClearedAt == null)
            .ToListAsync(cancellationToken);

        if (openFollowUps.Count == 0)
        {
            return NotFoundProblem($"Open follow-up for entity '{normalizedEntityType}' with id '{id}' was not found.");
        }

        var now = DateTime.UtcNow;
        foreach (var followUp in openFollowUps)
        {
            followUp.ClearedAt = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    private async Task<(string Title, string Location)?> ResolveEntityDetailsAsync(string entityType, Guid entityId, Guid userId, CancellationToken cancellationToken)
    {
        switch (entityType)
        {
            case "log":
            {
                var log = await dbContext.Logs.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.Title })
                    .SingleOrDefaultAsync(cancellationToken);
                return log is null ? null : (log.Title, $"/logs/{entityId}");
            }
            case "listentry":
            {
                var entry = await dbContext.ListEntries.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.ListType.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                return entry is null ? null : ($"{entry.Name} Entry", $"/entries/{entityId}");
            }
            case "list":
            {
                var list = await dbContext.ListTypes.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                return list is null ? null : (list.Name, $"/lists/{entityId}");
            }
            case "mindmap":
            {
                var mindMap = await dbContext.MindMaps.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.Title })
                    .SingleOrDefaultAsync(cancellationToken);
                return mindMap is null ? null : (mindMap.Title, $"/mindmaps/{entityId}");
            }
            case "note":
            {
                var note = await dbContext.Notes.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.Content })
                    .SingleOrDefaultAsync(cancellationToken);
                return note is null ? null : (SummarizeNote(note.Content), $"/notes");
            }
            case "kase":
            {
                var kase = await dbContext.Kases.AsNoTracking().Where(x => x.Id == entityId && x.UserId == userId)
                    .Select(x => new { x.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                return kase is null ? null : (kase.Name, $"/kases/{entityId}");
            }
            default:
                return null;
        }
    }

    private async Task<string?> ResolveSourceTagAsync(string entityType, Guid entityId, CancellationToken cancellationToken)
    {
        var sourceTag = await dbContext.EntityTags.AsNoTracking()
            .Where(x => x.EntityType == entityType && x.EntityId == entityId && x.Tag.Name.StartsWith("source:"))
            .Select(x => x.Tag.Name)
            .OrderBy(x => x)
            .FirstOrDefaultAsync(cancellationToken);

        return sourceTag is null ? null : sourceTag["source:".Length..];
    }

    private static string SummarizeNote(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.Length == 0)
        {
            return "Untitled Note";
        }

        const int maxLength = 80;
        return trimmed.Length <= maxLength ? trimmed : $"{trimmed[..maxLength]}...";
    }
}
