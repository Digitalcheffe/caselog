using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/kases")]
[Tags("Kases")]
public sealed class KasesController(CaselogDbContext dbContext, TaggingService taggingService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<KaseResponse>>>> GetKases([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var page = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;
        var baseQuery = dbContext.Kases.AsNoTracking().Where(x => x.UserId == userId).OrderBy(x => x.Name);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new KaseResponse(x.Id, x.Name, x.Description, x.CreatedAt, x.UpdatedAt)).ToListAsync(cancellationToken);
        return Ok(new ApiEnvelope<PagedResult<KaseResponse>>(new PagedResult<KaseResponse>(items, new PaginationMeta(page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<KaseResponse>>> GetKase(Guid id, CancellationToken cancellationToken)
    {
        var kase = await dbContext.Kases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == GetUserId(), cancellationToken);
        return kase is null ? NotFoundProblem($"Kase '{id}' was not found.") : Ok(new ApiEnvelope<KaseResponse>(new KaseResponse(kase.Id, kase.Name, kase.Description, kase.CreatedAt, kase.UpdatedAt)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<KaseResponse>>> CreateKase(CreateKaseRequest request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var kase = new Kase { Id = Guid.NewGuid(), UserId = GetUserId(), Name = request.Name.Trim(), Description = request.Description, CreatedAt = now, UpdatedAt = now };
        dbContext.Kases.Add(kase);
        await taggingService.AddTagsAsync("kase", kase.Id, ["type:kase", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetKase), new { id = kase.Id }, new ApiEnvelope<KaseResponse>(new KaseResponse(kase.Id, kase.Name, kase.Description, kase.CreatedAt, kase.UpdatedAt)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<KaseResponse>>> UpdateKase(Guid id, UpdateKaseRequest request, CancellationToken cancellationToken)
    {
        var kase = await dbContext.Kases.SingleOrDefaultAsync(x => x.Id == id && x.UserId == GetUserId(), cancellationToken);
        if (kase is null) return NotFoundProblem($"Kase '{id}' was not found.");
        kase.Name = request.Name.Trim(); kase.Description = request.Description; kase.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<KaseResponse>(new KaseResponse(kase.Id, kase.Name, kase.Description, kase.CreatedAt, kase.UpdatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteKase(Guid id, CancellationToken cancellationToken)
    {
        var kase = await dbContext.Kases.SingleOrDefaultAsync(x => x.Id == id && x.UserId == GetUserId(), cancellationToken);
        if (kase is null) return NotFoundProblem($"Kase '{id}' was not found.");
        dbContext.Kases.Remove(kase); await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }
}
