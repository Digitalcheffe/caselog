using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Migrations;

public partial class AddUserIsDisabled : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsDisabled",
            table: "Users",
            type: "INTEGER",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "IsDisabled",
            table: "Users");
    }
}
