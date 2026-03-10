using System;
using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Migrations;

[DbContext(typeof(CaselogDbContext))]
[Migration("20260310010000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("Users", table => new
        {
            Id = table.Column<Guid>(type: "TEXT", nullable: false),
            Email = table.Column<string>(type: "TEXT", nullable: false),
            PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
            Role = table.Column<string>(type: "TEXT", nullable: false),
            TwoFactorEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
            TwoFactorSecret = table.Column<string>(type: "TEXT", nullable: true),
            CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
            LastLoginAt = table.Column<DateTime>(type: "TEXT", nullable: true),
            IsDisabled = table.Column<bool>(type: "INTEGER", nullable: false)
        }, constraints: table => table.PrimaryKey("PK_Users", x => x.Id));

        migrationBuilder.CreateTable("Tags", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), Name = table.Column<string>(type: "TEXT", nullable: false) }, constraints: table => table.PrimaryKey("PK_Tags", x => x.Id));
        migrationBuilder.CreateTable("UserApiKeys", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), KeyHash = table.Column<string>(type: "TEXT", nullable: false), Label = table.Column<string>(type: "TEXT", nullable: false), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), LastUsedAt = table.Column<DateTime>(type: "TEXT", nullable: true) }, constraints: table => { table.PrimaryKey("PK_UserApiKeys", x => x.Id); table.ForeignKey("FK_UserApiKeys_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade); });
        migrationBuilder.CreateTable("Kases", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), Name = table.Column<string>(type: "TEXT", nullable: false), Description = table.Column<string>(type: "TEXT", nullable: true), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false) }, constraints: table => table.PrimaryKey("PK_Kases", x => x.Id));
        migrationBuilder.CreateTable("Logs", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), KaseId = table.Column<Guid>(type: "TEXT", nullable: true), Title = table.Column<string>(type: "TEXT", nullable: false), Content = table.Column<string>(type: "TEXT", nullable: true), Visibility = table.Column<string>(type: "TEXT", nullable: false), PublicSlug = table.Column<string>(type: "TEXT", nullable: true), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), IsFollowUp = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false), FollowUpDueAt = table.Column<DateTime>(type: "TEXT", nullable: true) }, constraints: table => { table.PrimaryKey("PK_Logs", x => x.Id); table.ForeignKey("FK_Logs_Kases_KaseId", x => x.KaseId, "Kases", "Id"); });
        migrationBuilder.CreateTable("ListTypes", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), Name = table.Column<string>(type: "TEXT", nullable: false), Description = table.Column<string>(type: "TEXT", nullable: true), Visibility = table.Column<string>(type: "TEXT", nullable: false), PublicSlug = table.Column<string>(type: "TEXT", nullable: true), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false) }, constraints: table => table.PrimaryKey("PK_ListTypes", x => x.Id));
        migrationBuilder.CreateTable("ListFields", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), ListTypeId = table.Column<Guid>(type: "TEXT", nullable: false), FieldName = table.Column<string>(type: "TEXT", nullable: false), FieldType = table.Column<string>(type: "TEXT", nullable: false), Required = table.Column<bool>(type: "INTEGER", nullable: false), SortOrder = table.Column<int>(type: "INTEGER", nullable: false) }, constraints: table => { table.PrimaryKey("PK_ListFields", x => x.Id); table.ForeignKey("FK_ListFields_ListTypes_ListTypeId", x => x.ListTypeId, "ListTypes", "Id", onDelete: ReferentialAction.Cascade); });
        migrationBuilder.CreateTable("ListEntries", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), ListTypeId = table.Column<Guid>(type: "TEXT", nullable: false), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false) }, constraints: table => { table.PrimaryKey("PK_ListEntries", x => x.Id); table.ForeignKey("FK_ListEntries_ListTypes_ListTypeId", x => x.ListTypeId, "ListTypes", "Id", onDelete: ReferentialAction.Cascade); });
        migrationBuilder.CreateTable("MindMaps", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), Title = table.Column<string>(type: "TEXT", nullable: false), Visibility = table.Column<string>(type: "TEXT", nullable: false), PublicSlug = table.Column<string>(type: "TEXT", nullable: true), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false) }, constraints: table => table.PrimaryKey("PK_MindMaps", x => x.Id));
        migrationBuilder.CreateTable("MindMapNodes", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), MindMapId = table.Column<Guid>(type: "TEXT", nullable: false), ParentNodeId = table.Column<Guid>(type: "TEXT", nullable: true), Label = table.Column<string>(type: "TEXT", nullable: false), Notes = table.Column<string>(type: "TEXT", nullable: true), SortOrder = table.Column<int>(type: "INTEGER", nullable: false) }, constraints: table => table.PrimaryKey("PK_MindMapNodes", x => x.Id));
        migrationBuilder.CreateTable("Notes", table => new { Id = table.Column<Guid>(type: "TEXT", nullable: false), UserId = table.Column<Guid>(type: "TEXT", nullable: false), EntityType = table.Column<string>(type: "TEXT", nullable: true), EntityId = table.Column<Guid>(type: "TEXT", nullable: true), Content = table.Column<string>(type: "TEXT", nullable: false), Visibility = table.Column<string>(type: "TEXT", nullable: false), PublicSlug = table.Column<string>(type: "TEXT", nullable: true), CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false), UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false) }, constraints: table => table.PrimaryKey("PK_Notes", x => x.Id));
        migrationBuilder.CreateTable("EntityTags", table => new { EntityType = table.Column<string>(type: "TEXT", nullable: false), EntityId = table.Column<Guid>(type: "TEXT", nullable: false), TagId = table.Column<Guid>(type: "TEXT", nullable: false) }, constraints: table => { table.PrimaryKey("PK_EntityTags", x => new { x.EntityType, x.EntityId, x.TagId }); table.ForeignKey("FK_EntityTags_Tags_TagId", x => x.TagId, "Tags", "Id", onDelete: ReferentialAction.Cascade); });

        migrationBuilder.CreateIndex("IX_Users_Email", "Users", "Email", unique: true);
        migrationBuilder.CreateIndex("IX_Tags_Name", "Tags", "Name", unique: true);
        migrationBuilder.CreateIndex("IX_UserApiKeys_UserId", "UserApiKeys", "UserId");
        migrationBuilder.CreateIndex("IX_Logs_KaseId", "Logs", "KaseId");
        migrationBuilder.CreateIndex("IX_Logs_PublicSlug", "Logs", "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex("IX_ListFields_ListTypeId", "ListFields", "ListTypeId");
        migrationBuilder.CreateIndex("IX_ListEntries_ListTypeId", "ListEntries", "ListTypeId");
        migrationBuilder.CreateIndex("IX_MindMaps_PublicSlug", "MindMaps", "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex("IX_Notes_PublicSlug", "Notes", "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex("IX_ListTypes_PublicSlug", "ListTypes", "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex("IX_EntityTags_TagId", "EntityTags", "TagId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("EntityTags");
        migrationBuilder.DropTable("MindMapNodes");
        migrationBuilder.DropTable("ListEntries");
        migrationBuilder.DropTable("ListFields");
        migrationBuilder.DropTable("Logs");
        migrationBuilder.DropTable("Notes");
        migrationBuilder.DropTable("MindMaps");
        migrationBuilder.DropTable("UserApiKeys");
        migrationBuilder.DropTable("Tags");
        migrationBuilder.DropTable("ListTypes");
        migrationBuilder.DropTable("Kases");
        migrationBuilder.DropTable("Users");
    }
}
