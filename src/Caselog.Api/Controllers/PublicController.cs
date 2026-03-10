using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[ApiController]
[Route("public")]
public sealed class PublicController(CaselogDbContext dbContext) : ControllerBase
{
    [HttpGet("{slug}")]
    public async Task<ActionResult<ApiEnvelope<PublicItemResponse>>> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();

        var log = await dbContext.Logs.AsNoTracking()
            .Where(x => x.PublicSlug == normalizedSlug && x.Visibility == Visibility.Public)
            .Select(x => new PublicItemResponse("log", x.Id, x.Title, x.Content))
            .SingleOrDefaultAsync(cancellationToken);
        if (log is not null)
        {
            return Ok(new ApiEnvelope<PublicItemResponse>(log));
        }

        var list = await dbContext.ListTypes.AsNoTracking()
            .Where(x => x.PublicSlug == normalizedSlug && x.Visibility == Visibility.Public)
            .Select(x => new PublicItemResponse("list", x.Id, x.Name, x.Description ?? string.Empty))
            .SingleOrDefaultAsync(cancellationToken);
        if (list is not null)
        {
            return Ok(new ApiEnvelope<PublicItemResponse>(list));
        }

        var note = await dbContext.Notes.AsNoTracking()
            .Where(x => x.PublicSlug == normalizedSlug && x.Visibility == Visibility.Public)
            .Select(x => new PublicItemResponse("note", x.Id, "Note", x.Content))
            .SingleOrDefaultAsync(cancellationToken);
        if (note is not null)
        {
            return Ok(new ApiEnvelope<PublicItemResponse>(note));
        }

        var mindMap = await dbContext.MindMaps.AsNoTracking()
            .Where(x => x.PublicSlug == normalizedSlug && x.Visibility == Visibility.Public)
            .Select(x => new PublicItemResponse("mindmap", x.Id, x.Title, string.Empty))
            .SingleOrDefaultAsync(cancellationToken);
        if (mindMap is not null)
        {
            return Ok(new ApiEnvelope<PublicItemResponse>(mindMap));
        }

        return NotFound();
    }
}
