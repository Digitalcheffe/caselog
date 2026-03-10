using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/mindmaps")]
public sealed class MindMapsController(CaselogDbContext dbContext, TaggingService taggingService, MindMapSearchIndexService mindMapSearchIndexService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<MindMapResponse>>>> GetMindMaps([FromQuery] PaginationQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var log = query.NormalizedPage;
        var pageSize = query.NormalizedPageSize;

        var baseQuery = dbContext.MindMaps.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.UpdatedAt);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var items = await baseQuery
            .Skip((log - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new MindMapResponse(x.Id, x.Title, x.Visibility, x.PublicSlug, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<PagedResult<MindMapResponse>>(new PagedResult<MindMapResponse>(items, new PaginationMeta(log, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<MindMapDetailResponse>>> GetMindMap(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMap = await dbContext.MindMaps.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        var nodes = await dbContext.MindMapNodes.AsNoTracking()
            .Where(x => x.MindMapId == id)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Label)
            .ToListAsync(cancellationToken);

        var rootNodes = nodes.Where(x => x.ParentNodeId is null).ToList();
        if (rootNodes.Count != 1)
        {
            return Problem(
                title: "Invalid Mind Map",
                detail: $"Mind map '{id}' must contain exactly one root node.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var response = new MindMapDetailResponse(
            mindMap.Id,
            mindMap.Title,
            mindMap.Visibility,
            mindMap.PublicSlug,
            mindMap.CreatedAt,
            mindMap.UpdatedAt,
            BuildNodeTree(rootNodes[0], nodes));

        return Ok(new ApiEnvelope<MindMapDetailResponse>(response));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<MindMapDetailResponse>>> CreateMindMap([FromBody] MindMapRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var now = DateTime.UtcNow;
        var mindMap = new MindMap
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = request.Title.Trim(),
            Visibility = request.Visibility,
            PublicSlug = request.PublicSlug,
            CreatedAt = now,
            UpdatedAt = now
        };

        var rootNode = new MindMapNode
        {
            Id = Guid.NewGuid(),
            MindMapId = mindMap.Id,
            ParentNodeId = null,
            Label = mindMap.Title,
            SortOrder = 0
        };

        dbContext.MindMaps.Add(mindMap);
        dbContext.MindMapNodes.Add(rootNode);

        await taggingService.AddTagsAsync("mindmap", mindMap.Id, ["type:mindmap", "source:manual"], cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.UpsertAsync(mindMap.Id, cancellationToken);

        var response = new MindMapDetailResponse(
            mindMap.Id,
            mindMap.Title,
            mindMap.Visibility,
            mindMap.PublicSlug,
            mindMap.CreatedAt,
            mindMap.UpdatedAt,
            new MindMapNodeResponse(rootNode.Id, mindMap.Id, null, rootNode.Label, rootNode.Notes, rootNode.SortOrder, []));

        return CreatedAtAction(nameof(GetMindMap), new { id = mindMap.Id }, new ApiEnvelope<MindMapDetailResponse>(response));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<MindMapResponse>>> UpdateMindMap(Guid id, [FromBody] MindMapRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMap = await dbContext.MindMaps.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        mindMap.Title = request.Title.Trim();
        mindMap.Visibility = request.Visibility;
        mindMap.PublicSlug = request.PublicSlug;
        mindMap.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.UpsertAsync(mindMap.Id, cancellationToken);

        return Ok(new ApiEnvelope<MindMapResponse>(new MindMapResponse(mindMap.Id, mindMap.Title, mindMap.Visibility, mindMap.PublicSlug, mindMap.CreatedAt, mindMap.UpdatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteMindMap(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMap = await dbContext.MindMaps.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        dbContext.MindMaps.Remove(mindMap);
        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.DeleteAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpPost("{id:guid}/nodes")]
    public async Task<ActionResult<ApiEnvelope<MindMapNodeResponse>>> CreateNode(Guid id, [FromBody] MindMapNodeRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMap = await dbContext.MindMaps.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        if (request.ParentNodeId is null)
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["parentNodeId"] = ["Mind maps can only have one root node."] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var parentExists = await dbContext.MindMapNodes.AsNoTracking().AnyAsync(x => x.Id == request.ParentNodeId && x.MindMapId == id, cancellationToken);
        if (!parentExists)
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["parentNodeId"] = ["Parent node does not exist in this mind map."] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var node = new MindMapNode
        {
            Id = Guid.NewGuid(),
            MindMapId = id,
            ParentNodeId = request.ParentNodeId,
            Label = request.Label.Trim(),
            Notes = request.Notes,
            SortOrder = request.SortOrder
        };

        dbContext.MindMapNodes.Add(node);
        mindMap.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.UpsertAsync(id, cancellationToken);

        return CreatedAtAction(nameof(GetMindMap), new { id }, new ApiEnvelope<MindMapNodeResponse>(new MindMapNodeResponse(node.Id, node.MindMapId, node.ParentNodeId, node.Label, node.Notes, node.SortOrder, [])));
    }

    [HttpPut("{id:guid}/nodes/{nodeId:guid}")]
    public async Task<ActionResult<ApiEnvelope<MindMapNodeResponse>>> UpdateNode(Guid id, Guid nodeId, [FromBody] MindMapNodeRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMapExists = await dbContext.MindMaps.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!mindMapExists)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        var node = await dbContext.MindMapNodes.SingleOrDefaultAsync(x => x.Id == nodeId && x.MindMapId == id, cancellationToken);
        if (node is null)
        {
            return NotFoundProblem($"Mind map node '{nodeId}' was not found.");
        }

        if (request.ParentNodeId is null)
        {
            var rootCount = await dbContext.MindMapNodes.AsNoTracking().CountAsync(x => x.MindMapId == id && x.ParentNodeId == null && x.Id != nodeId, cancellationToken);
            if (rootCount > 0)
            {
                return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["parentNodeId"] = ["Mind maps can only have one root node."] })
                {
                    Title = "One or more validation errors occurred.",
                    Status = StatusCodes.Status400BadRequest
                });
            }
        }
        else
        {
            if (request.ParentNodeId == nodeId)
            {
                return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["parentNodeId"] = ["A node cannot be parent of itself."] })
                {
                    Title = "One or more validation errors occurred.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            var parentExists = await dbContext.MindMapNodes.AsNoTracking().AnyAsync(x => x.Id == request.ParentNodeId && x.MindMapId == id, cancellationToken);
            if (!parentExists)
            {
                return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["parentNodeId"] = ["Parent node does not exist in this mind map."] })
                {
                    Title = "One or more validation errors occurred.",
                    Status = StatusCodes.Status400BadRequest
                });
            }
        }

        node.ParentNodeId = request.ParentNodeId;
        node.Label = request.Label.Trim();
        node.Notes = request.Notes;
        node.SortOrder = request.SortOrder;

        var mindMap = await dbContext.MindMaps.SingleAsync(x => x.Id == id, cancellationToken);
        mindMap.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.UpsertAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<MindMapNodeResponse>(new MindMapNodeResponse(node.Id, node.MindMapId, node.ParentNodeId, node.Label, node.Notes, node.SortOrder, [])));
    }

    [HttpDelete("{id:guid}/nodes/{nodeId:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteNode(Guid id, Guid nodeId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var mindMap = await dbContext.MindMaps.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (mindMap is null)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        var node = await dbContext.MindMapNodes.SingleOrDefaultAsync(x => x.Id == nodeId && x.MindMapId == id, cancellationToken);
        if (node is null)
        {
            return NotFoundProblem($"Mind map node '{nodeId}' was not found.");
        }

        if (node.ParentNodeId is null)
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["nodeId"] = ["Root node cannot be deleted."] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var childNodes = await dbContext.MindMapNodes.Where(x => x.ParentNodeId == nodeId).ToListAsync(cancellationToken);
        foreach (var child in childNodes)
        {
            child.ParentNodeId = node.ParentNodeId;
        }

        dbContext.MindMapNodes.Remove(node);
        mindMap.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await mindMapSearchIndexService.UpsertAsync(id, cancellationToken);

        return Ok(new ApiEnvelope<object>(new { deleted = true }));
    }

    [HttpGet("{id:guid}/export")]
    public async Task<ActionResult<ApiEnvelope<MindMapExportResponse>>> Export(Guid id, [FromQuery] string format, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var exists = await dbContext.MindMaps.AsNoTracking().AnyAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (!exists)
        {
            return NotFoundProblem($"Mind map '{id}' was not found.");
        }

        var normalizedFormat = format.Trim().ToLowerInvariant();
        if (normalizedFormat is not ("png" or "svg"))
        {
            return base.ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["format"] = ["Supported export formats are png and svg."] })
            {
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        return Ok(new ApiEnvelope<MindMapExportResponse>(
            new MindMapExportResponse(id, normalizedFormat, $"Placeholder export for '{normalizedFormat}' is not implemented yet.")));
    }

    private static MindMapNodeResponse BuildNodeTree(MindMapNode node, IReadOnlyCollection<MindMapNode> allNodes)
    {
        var children = allNodes
            .Where(x => x.ParentNodeId == node.Id)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Label)
            .Select(child => BuildNodeTree(child, allNodes))
            .ToList();

        return new MindMapNodeResponse(node.Id, node.MindMapId, node.ParentNodeId, node.Label, node.Notes, node.SortOrder, children);
    }
}
