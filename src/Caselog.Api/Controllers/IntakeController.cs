using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/intake")]
public sealed class IntakeController(CaselogDbContext dbContext, TaggingService taggingService, LogSearchIndexService logSearchIndexService) : BaseApiController
{
    [HttpPost]
    [Consumes("text/markdown")]
    public async Task<ActionResult<ApiEnvelope<IntakeResponse>>> Intake([FromBody] string body, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var log = new Log
        {
            Id = Guid.NewGuid(),
            UserId = GetUserId(),
            KaseId = null,
            Title = "Intake",
            Content = body,
            Visibility = Visibility.Private,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Logs.Add(log);
        await dbContext.SaveChangesAsync(cancellationToken);
        await taggingService.AddTagsAsync("log", log.Id, ["type:log", "source:manual"], cancellationToken);
        await logSearchIndexService.UpsertAsync(log, cancellationToken);

        return Ok(new ApiEnvelope<IntakeResponse>(new IntakeResponse(log.Id, $"/logs/{log.Id}")));
    }
}
