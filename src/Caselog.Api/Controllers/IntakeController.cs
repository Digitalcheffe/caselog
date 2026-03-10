using System.Globalization;
using System.Text;
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
public sealed class IntakeController(CaselogDbContext dbContext, TaggingService taggingService, PageSearchIndexService pageSearchIndexService) : BaseApiController
{
    [HttpPost]
    [Consumes("text/markdown", "text/plain")]
    public async Task<ActionResult<ApiEnvelope<IntakeResponse>>> Intake(CancellationToken cancellationToken)
    {
        var contentType = Request.ContentType ?? string.Empty;
        var isMarkdown = contentType.StartsWith("text/markdown", StringComparison.OrdinalIgnoreCase)
            || contentType.StartsWith("text/plain", StringComparison.OrdinalIgnoreCase);
        if (!isMarkdown)
        {
            return Problem(statusCode: StatusCodes.Status415UnsupportedMediaType, title: "Unsupported media type", detail: "Use Content-Type: text/markdown.");
        }

        string body;
        using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
        {
            body = await reader.ReadToEndAsync(cancellationToken);
        }

        var userId = GetUserId();
        var parsed = ParseMarkdown(body);

        Guid? notebookId = null;

        if (!string.IsNullOrWhiteSpace(parsed.Shelf) || !string.IsNullOrWhiteSpace(parsed.Notebook))
        {
            var shelf = await ResolveShelfAsync(userId, parsed.Shelf, cancellationToken);
            var notebook = await ResolveNotebookAsync(userId, shelf?.Id, parsed.Notebook, cancellationToken);
            notebookId = notebook?.Id;
        }

        var now = DateTime.UtcNow;
        var page = new Page
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            NotebookId = notebookId,
            Title = ResolveTitle(parsed.MarkdownContent),
            Content = parsed.MarkdownContent,
            Visibility = Visibility.Private,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Pages.Add(page);

        var source = string.IsNullOrWhiteSpace(parsed.Source) ? "webhook" : parsed.Source.Trim().ToLowerInvariant();
        var tags = new HashSet<string>(StringComparer.Ordinal)
        {
            "type:page",
            $"source:{source}"
        };

        foreach (var tag in parsed.Tags)
        {
            tags.Add(tag);
        }

        await taggingService.AddTagsAsync("page", page.Id, tags, cancellationToken);

        if (parsed.FollowUp)
        {
            dbContext.FollowUps.Add(new FollowUp
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EntityType = "page",
                EntityId = page.Id,
                Note = string.IsNullOrWhiteSpace(parsed.FollowUpNote) ? "Follow up required" : parsed.FollowUpNote.Trim(),
                CreatedAt = now
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageSearchIndexService.UpsertAsync(page, cancellationToken);

        return Ok(new ApiEnvelope<IntakeResponse>(new IntakeResponse(page.Id, $"/pages/{page.Id}")));
    }

    private async Task<Shelf?> ResolveShelfAsync(Guid userId, string? shelfName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(shelfName))
        {
            return null;
        }

        var trimmed = shelfName.Trim();
        var existing = await dbContext.Shelves.SingleOrDefaultAsync(x => x.UserId == userId && x.Name == trimmed, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var now = DateTime.UtcNow;
        var shelf = new Shelf
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = trimmed,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Shelves.Add(shelf);
        return shelf;
    }

    private async Task<Notebook?> ResolveNotebookAsync(Guid userId, Guid? shelfId, string? notebookName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(notebookName))
        {
            return null;
        }

        var trimmed = notebookName.Trim();
        var existing = await dbContext.Notebooks.SingleOrDefaultAsync(
            x => x.UserId == userId && x.Name == trimmed && x.ShelfId == shelfId,
            cancellationToken);

        if (existing is not null)
        {
            return existing;
        }

        var now = DateTime.UtcNow;
        var notebook = new Notebook
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShelfId = shelfId,
            Name = trimmed,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Notebooks.Add(notebook);
        return notebook;
    }

    private static string ResolveTitle(string markdown)
    {
        var heading = markdown.Split('\n')
            .Select(x => x.Trim())
            .FirstOrDefault(x => x.StartsWith("# ", StringComparison.Ordinal));

        if (!string.IsNullOrWhiteSpace(heading))
        {
            return heading[2..].Trim();
        }

        var firstLine = markdown.Split('\n').Select(x => x.Trim()).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        if (!string.IsNullOrWhiteSpace(firstLine))
        {
            return firstLine.Length > 80 ? firstLine[..80] : firstLine;
        }

        return $"Intake {DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)}";
    }

    private static ParsedIntake ParseMarkdown(string body)
    {
        var content = body.Replace("\r\n", "\n");
        if (!content.StartsWith("---\n", StringComparison.Ordinal))
        {
            return new ParsedIntake { MarkdownContent = content.Trim() };
        }

        var end = content.IndexOf("\n---\n", 4, StringComparison.Ordinal);
        if (end < 0)
        {
            return new ParsedIntake { MarkdownContent = content.Trim() };
        }

        var frontmatter = content[4..end];
        var markdown = content[(end + 5)..].Trim();
        var parsed = new ParsedIntake { MarkdownContent = markdown };

        var lines = frontmatter.Split('\n');
        var collectingTags = false;

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            if (collectingTags && line.TrimStart().StartsWith("- ", StringComparison.Ordinal))
            {
                parsed.Tags.Add(line.TrimStart()[2..].Trim());
                continue;
            }

            collectingTags = false;
            var separatorIndex = line.IndexOf(':');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim().ToLowerInvariant();
            var value = line[(separatorIndex + 1)..].Trim();

            switch (key)
            {
                case "shelf":
                    parsed.Shelf = value;
                    break;
                case "notebook":
                    parsed.Notebook = value;
                    break;
                case "source":
                    parsed.Source = value;
                    break;
                case "tags":
                    if (value.StartsWith('[') && value.EndsWith(']'))
                    {
                        foreach (var tag in value[1..^1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        {
                            parsed.Tags.Add(tag);
                        }
                    }
                    else if (string.IsNullOrWhiteSpace(value))
                    {
                        collectingTags = true;
                    }
                    else
                    {
                        parsed.Tags.AddRange(value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                    }
                    break;
                case "follow_up":
                    parsed.FollowUp = value.Equals("true", StringComparison.OrdinalIgnoreCase);
                    break;
                case "follow_up_note":
                    parsed.FollowUpNote = value;
                    break;
            }
        }

        parsed.Tags = TaggingService.NormalizeTagNames(parsed.Tags).ToList();
        return parsed;
    }

    private sealed class ParsedIntake
    {
        public string? Shelf { get; set; }
        public string? Notebook { get; set; }
        public string? Source { get; set; }
        public bool FollowUp { get; set; }
        public string? FollowUpNote { get; set; }
        public string MarkdownContent { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = [];
    }
}
