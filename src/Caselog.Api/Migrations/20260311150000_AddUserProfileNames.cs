using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Migrations;

[DbContext(typeof(CaselogDbContext))]
[Migration("20260311150000_AddUserProfileNames")]
public partial class AddUserProfileNames : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "FirstName",
            table: "Users",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "LastName",
            table: "Users",
            type: "TEXT",
            nullable: false,
            defaultValue: "");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "FirstName", table: "Users");
        migrationBuilder.DropColumn(name: "LastName", table: "Users");
    }
}
