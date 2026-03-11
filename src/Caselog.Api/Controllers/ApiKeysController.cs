using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/apikeys")]
public sealed class ApiKeysController(CaselogDbContext dbContext) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<ApiKeyResponse>>>> GetApiKeys(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var keys = await dbContext.UserApiKeys
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ApiKeyResponse(x.Id, x.Label, x.CreatedAt, x.LastUsedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<ApiKeyResponse>>(keys));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<CreateApiKeyResponse>>> CreateApiKey([FromBody] CreateApiKeyRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.EffectiveLabel))
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["label"] = ["Label is required."] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }
        var now = DateTime.UtcNow;
        var rawKey = ApiKeyHasher.GenerateApiKey();
        var entity = new UserApiKey
        {
            Id = Guid.NewGuid(),
            UserId = GetUserId(),
            Label = request.EffectiveLabel,
            CreatedAt = now,
            KeyHash = ApiKeyHasher.Hash(rawKey)
        };

        dbContext.UserApiKeys.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<CreateApiKeyResponse>(new CreateApiKeyResponse(entity.Id, entity.Label, entity.CreatedAt, rawKey)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteApiKey(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var key = await dbContext.UserApiKeys.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (key is null)
        {
            return NotFoundProblem($"API key '{id}' was not found.");
        }

        dbContext.UserApiKeys.Remove(key);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<object>(new { revoked = true }));
    }
}
