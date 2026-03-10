using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/logs")]
[Tags("Logs")]
public sealed class LogsController(CaselogDbContext dbContext, LogSearchIndexService searchIndexService, TaggingService taggingService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<LogResponse>>>> GetLogs([FromQuery] PaginationQuery query, [FromQuery] Guid? kaseId, [FromQuery] bool unassigned = false, CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;
        var baseQuery = dbContext.Logs.AsNoTracking().Where(x => x.UserId == userId);
        if (unassigned) baseQuery = baseQuery.Where(x => x.KaseId == null);
        if (kaseId.HasValue) baseQuery = baseQuery.Where(x => x.KaseId == kaseId);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.OrderBy(x => x.Title).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new LogResponse(x.Id, x.KaseId, x.Title, x.Content, x.Visibility, x.PublicSlug, x.CreatedAt, x.UpdatedAt, x.IsFollowUp, x.FollowUpDueAt)).ToListAsync(cancellationToken);
        return Ok(new ApiEnvelope<PagedResult<LogResponse>>(new PagedResult<LogResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<LogResponse>>> GetLog(Guid id, CancellationToken cancellationToken)
    {
        var log = await dbContext.Logs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == GetUserId(), cancellationToken);
        return log is null ? NotFoundProblem($"Log '{id}' was not found.") : Ok(new ApiEnvelope<LogResponse>(new LogResponse(log.Id, log.KaseId, log.Title, log.Content, log.Visibility, log.PublicSlug, log.CreatedAt, log.UpdatedAt, log.IsFollowUp, log.FollowUpDueAt)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<LogResponse>>> CreateLog(CreateLogRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (request.KaseId.HasValue && !await dbContext.Kases.AsNoTracking().AnyAsync(x => x.Id == request.KaseId && x.UserId == userId, cancellationToken))
            return NotFoundProblem($"Kase '{request.KaseId}' was not found.");

        var now = DateTime.UtcNow;
        var log = new Log { Id = Guid.NewGuid(), UserId = userId, KaseId = request.KaseId, Title = request.Title.Trim(), Content = request.Content, Visibility = request.Visibility, PublicSlug = request.PublicSlug, CreatedAt = now, UpdatedAt = now };
        dbContext.Logs.Add(log);
        await taggingService.AddTagsAsync("log", log.Id, ["type:log", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.UpsertAsync(log, cancellationToken);
        return CreatedAtAction(nameof(GetLog), new { id = log.Id }, new ApiEnvelope<LogResponse>(new LogResponse(log.Id, log.KaseId, log.Title, log.Content, log.Visibility, log.PublicSlug, log.CreatedAt, log.UpdatedAt, log.IsFollowUp, log.FollowUpDueAt)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<LogResponse>>> UpdateLog(Guid id, UpdateLogRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var log = await dbContext.Logs.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (log is null) return NotFoundProblem($"Log '{id}' was not found.");
        if (request.KaseId.HasValue && !await dbContext.Kases.AsNoTracking().AnyAsync(x => x.Id == request.KaseId && x.UserId == userId, cancellationToken)) return NotFoundProblem($"Kase '{request.KaseId}' was not found.");
        log.KaseId = request.KaseId; log.Title = request.Title.Trim(); log.Content = request.Content; log.Visibility = request.Visibility; log.PublicSlug = request.PublicSlug; log.IsFollowUp = request.IsFollowUp; log.FollowUpDueAt = request.FollowUpDueAt; log.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await searchIndexService.UpsertAsync(log, cancellationToken);
        return Ok(new ApiEnvelope<LogResponse>(new LogResponse(log.Id, log.KaseId, log.Title, log.Content, log.Visibility, log.PublicSlug, log.CreatedAt, log.UpdatedAt, log.IsFollowUp, log.FollowUpDueAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteLog(Guid id, CancellationToken cancellationToken)
    {
        var log = await dbContext.Logs.SingleOrDefaultAsync(x => x.Id == id && x.UserId == GetUserId(), cancellationToken);
        if (log is null) return NotFoundProblem($"Log '{id}' was not found.");
        dbContext.Logs.Remove(log); await dbContext.SaveChangesAsync(cancellationToken); await searchIndexService.DeleteAsync(id, cancellationToken);
        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }
}
