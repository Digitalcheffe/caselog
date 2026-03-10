using System.Data.Common;
using System.Globalization;
using System.Text.RegularExpressions;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Caselog.Api.Data;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/search")]
public sealed partial class SearchController(CaselogDbContext dbContext) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<SearchResponse>>> Search(
        [FromQuery] string? q,
        [FromQuery] PaginationQuery pagination,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var parsed = ParseQuery(q);
        var page = pagination.NormalizedPage;
        var pageSize = pagination.NormalizedPageSize;

        await using var connection = dbContext.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        var whereClauses = new List<string>
        {
            "((si.entity_type = 'page' AND p.UserId = @userId) OR (si.entity_type = 'note' AND n.UserId = @userId) OR (si.entity_type = 'listentry' AND le.UserId = @userId) OR (si.entity_type = 'mindmap' AND mm.UserId = @userId))"
        };

        var matchQuery = BuildFtsQuery(parsed.Terms);
        if (!string.IsNullOrWhiteSpace(matchQuery))
        {
            whereClauses.Add("search_index MATCH @match");
        }

        if (!string.IsNullOrWhiteSpace(parsed.Type))
        {
            whereClauses.Add("si.entity_type = @type");
        }

        if (!string.IsNullOrWhiteSpace(parsed.Tag))
        {
            whereClauses.Add("EXISTS (SELECT 1 FROM EntityTags et JOIN Tags t ON t.Id = et.TagId WHERE et.EntityType = si.entity_type AND et.EntityId = si.entity_id AND t.Name = @tag)");
        }

        if (!string.IsNullOrWhiteSpace(parsed.Source))
        {
            whereClauses.Add("EXISTS (SELECT 1 FROM EntityTags et JOIN Tags t ON t.Id = et.TagId WHERE et.EntityType = si.entity_type AND et.EntityId = si.entity_id AND t.Name = @sourceTag)");
        }

        if (parsed.After is not null)
        {
            whereClauses.Add("COALESCE(p.CreatedAt, n.CreatedAt, le.CreatedAt, mm.CreatedAt) >= @after");
        }

        if (!string.IsNullOrWhiteSpace(parsed.Shelf))
        {
            whereClauses.Add("si.entity_type = 'page' AND s.Name = @shelf");
        }

        if (!string.IsNullOrWhiteSpace(parsed.Notebook))
        {
            whereClauses.Add("si.entity_type = 'page' AND nb.Name = @notebook");
        }

        var whereSql = string.Join(" AND ", whereClauses);
        var offset = (page - 1) * pageSize;

        var countSql = $"""
            SELECT COUNT(*)
            FROM search_index si
            LEFT JOIN Pages p ON si.entity_type = 'page' AND p.Id = si.entity_id
            LEFT JOIN Notebooks nb ON p.NotebookId = nb.Id
            LEFT JOIN Shelves s ON nb.ShelfId = s.Id
            LEFT JOIN Notes n ON si.entity_type = 'note' AND n.Id = si.entity_id
            LEFT JOIN ListEntries le ON si.entity_type = 'listentry' AND le.Id = si.entity_id
            LEFT JOIN MindMaps mm ON si.entity_type = 'mindmap' AND mm.Id = si.entity_id
            WHERE {whereSql};
            """;

        var totalCount = await ExecuteCountAsync(connection, countSql, parsed, userId, matchQuery, cancellationToken);

        var sql = $"""
            SELECT
                si.entity_type,
                si.entity_id,
                COALESCE(NULLIF(si.title, ''),
                    CASE
                        WHEN si.entity_type = 'note' THEN 'Note'
                        WHEN si.entity_type = 'listentry' THEN COALESCE(lt.Name, 'List Entry')
                        WHEN si.entity_type = 'mindmap' THEN 'Mind Map'
                        ELSE 'Untitled'
                    END
                ) AS title,
                COALESCE(snippet(search_index, 3, '<mark>', '</mark>', ' … ', 24), substr(COALESCE(si.content, ''), 1, 240)) AS snippet,
                COALESCE(si.tags, '') AS tags,
                CASE
                    WHEN si.entity_type = 'page' THEN
                        CASE
                            WHEN s.Name IS NOT NULL AND nb.Name IS NOT NULL THEN s.Name || ' / ' || nb.Name
                            WHEN nb.Name IS NOT NULL THEN nb.Name
                            ELSE 'Unorganized'
                        END
                    WHEN si.entity_type = 'listentry' THEN COALESCE(lt.Name, 'List Entry')
                    WHEN si.entity_type = 'mindmap' THEN 'Mind maps'
                    WHEN si.entity_type = 'note' THEN 'Notes'
                    ELSE NULL
                END AS location,
                COALESCE(p.CreatedAt, n.CreatedAt, le.CreatedAt, mm.CreatedAt) AS created_at,
                bm25(search_index, 0.0, 0.0, 12.0, 1.0, 8.0, 4.0) AS rank
            FROM search_index si
            LEFT JOIN Pages p ON si.entity_type = 'page' AND p.Id = si.entity_id
            LEFT JOIN Notebooks nb ON p.NotebookId = nb.Id
            LEFT JOIN Shelves s ON nb.ShelfId = s.Id
            LEFT JOIN Notes n ON si.entity_type = 'note' AND n.Id = si.entity_id
            LEFT JOIN ListEntries le ON si.entity_type = 'listentry' AND le.Id = si.entity_id
            LEFT JOIN ListTypes lt ON le.ListTypeId = lt.Id
            LEFT JOIN MindMaps mm ON si.entity_type = 'mindmap' AND mm.Id = si.entity_id
            WHERE {whereSql}
            ORDER BY rank ASC, created_at DESC
            LIMIT @limit OFFSET @offset;
            """;

        var items = await ExecuteItemsAsync(connection, sql, parsed, userId, matchQuery, pageSize, offset, cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return Ok(new ApiEnvelope<SearchResponse>(new SearchResponse(items, new PaginationMeta(page, pageSize, totalCount, totalPages), BuildParsedQueryEcho(parsed))));
    }

    private static async Task<int> ExecuteCountAsync(DbConnection connection, string sql, ParsedSearchQuery parsed, Guid userId, string? matchQuery, CancellationToken cancellationToken)
    {
        await using var command = CreateCommand(connection, sql, parsed, userId, matchQuery, null, null);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result, CultureInfo.InvariantCulture);
    }

    private static async Task<IReadOnlyList<SearchResultItem>> ExecuteItemsAsync(DbConnection connection, string sql, ParsedSearchQuery parsed, Guid userId, string? matchQuery, int limit, int offset, CancellationToken cancellationToken)
    {
        await using var command = CreateCommand(connection, sql, parsed, userId, matchQuery, limit, offset);
        var items = new List<SearchResultItem>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var entityType = reader.GetString(0);
            var entityId = Guid.Parse(reader.GetString(1));
            var title = reader.GetString(2);
            var snippet = reader.IsDBNull(3) ? string.Empty : reader.GetString(3);
            var tags = reader.IsDBNull(4)
                ? Array.Empty<string>()
                : reader.GetString(4).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var location = reader.IsDBNull(5) ? null : reader.GetString(5);
            var createdAt = reader.GetDateTime(6);

            items.Add(new SearchResultItem(entityType, entityId, title, snippet, tags, location, DateTime.SpecifyKind(createdAt, DateTimeKind.Utc)));
        }

        return items;
    }

    private static DbCommand CreateCommand(DbConnection connection, string sql, ParsedSearchQuery parsed, Guid userId, string? matchQuery, int? limit, int? offset)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;

        AddParameter(command, "@userId", userId.ToString());
        if (!string.IsNullOrWhiteSpace(matchQuery)) AddParameter(command, "@match", matchQuery);
        if (!string.IsNullOrWhiteSpace(parsed.Type)) AddParameter(command, "@type", parsed.Type!);
        if (!string.IsNullOrWhiteSpace(parsed.Tag)) AddParameter(command, "@tag", parsed.Tag!);
        if (!string.IsNullOrWhiteSpace(parsed.Source)) AddParameter(command, "@sourceTag", $"source:{parsed.Source}");
        if (parsed.After is not null) AddParameter(command, "@after", parsed.After.Value.UtcDateTime);
        if (!string.IsNullOrWhiteSpace(parsed.Shelf)) AddParameter(command, "@shelf", parsed.Shelf!);
        if (!string.IsNullOrWhiteSpace(parsed.Notebook)) AddParameter(command, "@notebook", parsed.Notebook!);
        if (limit.HasValue) AddParameter(command, "@limit", limit.Value);
        if (offset.HasValue) AddParameter(command, "@offset", offset.Value);

        return command;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static string? BuildFtsQuery(IEnumerable<string> terms)
    {
        var preparedTerms = terms
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Contains(' ') ? $"\"{x.Replace("\"", "\"\"")}\"" : x)
            .ToArray();

        return preparedTerms.Length == 0 ? null : string.Join(" ", preparedTerms);
    }

    private static string? BuildParsedQueryEcho(ParsedSearchQuery parsed)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(parsed.Tag)) parts.Add($"tag:{parsed.Tag}");
        if (!string.IsNullOrWhiteSpace(parsed.Shelf)) parts.Add($"shelf:{parsed.Shelf}");
        if (!string.IsNullOrWhiteSpace(parsed.Notebook)) parts.Add($"notebook:{parsed.Notebook}");
        if (!string.IsNullOrWhiteSpace(parsed.Source)) parts.Add($"source:{parsed.Source}");
        if (parsed.After is not null) parts.Add($"after:{parsed.After:yyyy-MM-dd}");
        if (!string.IsNullOrWhiteSpace(parsed.Type)) parts.Add($"type:{parsed.Type}");
        parts.AddRange(parsed.Terms);

        return parts.Count == 0 ? null : string.Join(' ', parts);
    }

    private static ParsedSearchQuery ParseQuery(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new ParsedSearchQuery();
        }

        var parsed = new ParsedSearchQuery();
        foreach (Match match in TokenRegex().Matches(raw))
        {
            var token = match.Value.Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                continue;
            }

            var normalizedToken = token.StartsWith('"') && token.EndsWith('"')
                ? token[1..^1]
                : token;

            var separatorIndex = normalizedToken.IndexOf(':');
            if (separatorIndex <= 0)
            {
                parsed.Terms.Add(normalizedToken);
                continue;
            }

            var key = normalizedToken[..separatorIndex].Trim().ToLowerInvariant();
            var value = normalizedToken[(separatorIndex + 1)..].Trim().Trim('"');
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            switch (key)
            {
                case "tag":
                    parsed.Tag = value.ToLowerInvariant();
                    break;
                case "shelf":
                    parsed.Shelf = value;
                    break;
                case "notebook":
                    parsed.Notebook = value;
                    break;
                case "source":
                    parsed.Source = value.ToLowerInvariant();
                    break;
                case "after" when DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var afterDate):
                    parsed.After = afterDate.ToUniversalTime();
                    break;
                case "type":
                    parsed.Type = NormalizeEntityType(value);
                    break;
                default:
                    parsed.Terms.Add(normalizedToken);
                    break;
            }
        }

        return parsed;
    }

    private static string NormalizeEntityType(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "list" => "listentry",
            _ => normalized
        };
    }

    [GeneratedRegex("\\w+:\\\"[^\\\"]+\\\"|\\\"[^\\\"]+\\\"|\\S+")]
    private static partial Regex TokenRegex();

    private sealed class ParsedSearchQuery
    {
        public string? Tag { get; set; }
        public string? Shelf { get; set; }
        public string? Notebook { get; set; }
        public string? Source { get; set; }
        public DateTimeOffset? After { get; set; }
        public string? Type { get; set; }
        public List<string> Terms { get; } = [];
    }
}
