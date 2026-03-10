using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Migrations;

public partial class AddSortOrderToPageMindMapAttachments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "SortOrder",
            table: "PageMindMapAttachments",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "SortOrder",
            table: "PageMindMapAttachments");
    }
}
