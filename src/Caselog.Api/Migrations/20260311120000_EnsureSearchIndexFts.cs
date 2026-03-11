using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Migrations;

[DbContext(typeof(CaselogDbContext))]
[Migration("20260311120000_EnsureSearchIndexFts")]
public partial class EnsureSearchIndexFts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS search_index;
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
              entity_type,
              entity_id,
              title,
              content,
              tags,
              summary
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS search_index;");
    }
}
