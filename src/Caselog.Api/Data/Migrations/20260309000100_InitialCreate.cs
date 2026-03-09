using System;
using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Caselog.Api.Data.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "FollowUps",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                EntityType = table.Column<string>(type: "TEXT", nullable: false),
                EntityId = table.Column<Guid>(type: "TEXT", nullable: false),
                Note = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                ClearedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_FollowUps", x => x.Id));

        migrationBuilder.CreateTable(
            name: "MindMaps",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                Title = table.Column<string>(type: "TEXT", nullable: false),
                Visibility = table.Column<string>(type: "TEXT", nullable: false),
                PublicSlug = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_MindMaps", x => x.Id));

        migrationBuilder.CreateTable(
            name: "Notes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                EntityType = table.Column<string>(type: "TEXT", nullable: true),
                EntityId = table.Column<Guid>(type: "TEXT", nullable: true),
                Content = table.Column<string>(type: "TEXT", nullable: false),
                Visibility = table.Column<string>(type: "TEXT", nullable: false),
                PublicSlug = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Notes", x => x.Id));

        migrationBuilder.CreateTable(
            name: "Shelves",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", nullable: false),
                Description = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Shelves", x => x.Id));

        migrationBuilder.CreateTable(
            name: "Tags",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Tags", x => x.Id));

        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                Email = table.Column<string>(type: "TEXT", nullable: false),
                PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                Role = table.Column<string>(type: "TEXT", nullable: false),
                TwoFactorEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                TwoFactorSecret = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                LastLoginAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_Users", x => x.Id));

        migrationBuilder.CreateTable(
            name: "ListTypes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", nullable: false),
                Description = table.Column<string>(type: "TEXT", nullable: true),
                Visibility = table.Column<string>(type: "TEXT", nullable: false),
                PublicSlug = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_ListTypes", x => x.Id));

        migrationBuilder.CreateTable(
            name: "MindMapNodes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                MindMapId = table.Column<Guid>(type: "TEXT", nullable: false),
                ParentNodeId = table.Column<Guid>(type: "TEXT", nullable: true),
                Label = table.Column<string>(type: "TEXT", nullable: false),
                Notes = table.Column<string>(type: "TEXT", nullable: true),
                SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MindMapNodes", x => x.Id);
                table.ForeignKey("FK_MindMapNodes_MindMapNodes_ParentNodeId", x => x.ParentNodeId, "MindMapNodes", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_MindMapNodes_MindMaps_MindMapId", x => x.MindMapId, "MindMaps", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "Notebooks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                ShelfId = table.Column<Guid>(type: "TEXT", nullable: true),
                Name = table.Column<string>(type: "TEXT", nullable: false),
                Description = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Notebooks", x => x.Id);
                table.ForeignKey("FK_Notebooks_Shelves_ShelfId", x => x.ShelfId, "Shelves", "Id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateTable(
            name: "EntityTags",
            columns: table => new
            {
                EntityType = table.Column<string>(type: "TEXT", nullable: false),
                EntityId = table.Column<Guid>(type: "TEXT", nullable: false),
                TagId = table.Column<Guid>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EntityTags", x => new { x.EntityType, x.EntityId, x.TagId });
                table.ForeignKey("FK_EntityTags_Tags_TagId", x => x.TagId, "Tags", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "UserApiKeys",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                KeyHash = table.Column<string>(type: "TEXT", nullable: false),
                Label = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                LastUsedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserApiKeys", x => x.Id);
                table.ForeignKey("FK_UserApiKeys_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ListEntries",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                ListTypeId = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ListEntries", x => x.Id);
                table.ForeignKey("FK_ListEntries_ListTypes_ListTypeId", x => x.ListTypeId, "ListTypes", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ListTypeFields",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                ListTypeId = table.Column<Guid>(type: "TEXT", nullable: false),
                FieldName = table.Column<string>(type: "TEXT", nullable: false),
                FieldType = table.Column<string>(type: "TEXT", nullable: false),
                Required = table.Column<bool>(type: "INTEGER", nullable: false),
                SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ListTypeFields", x => x.Id);
                table.ForeignKey("FK_ListTypeFields_ListTypes_ListTypeId", x => x.ListTypeId, "ListTypes", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "Pages",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                NotebookId = table.Column<Guid>(type: "TEXT", nullable: true),
                Title = table.Column<string>(type: "TEXT", nullable: false),
                Content = table.Column<string>(type: "TEXT", nullable: false),
                Visibility = table.Column<string>(type: "TEXT", nullable: false),
                PublicSlug = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Pages", x => x.Id);
                table.ForeignKey("FK_Pages_Notebooks_NotebookId", x => x.NotebookId, "Notebooks", "Id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateTable(
            name: "ListEntryFieldValues",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                ListEntryId = table.Column<Guid>(type: "TEXT", nullable: false),
                ListTypeFieldId = table.Column<Guid>(type: "TEXT", nullable: false),
                Value = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ListEntryFieldValues", x => x.Id);
                table.ForeignKey("FK_ListEntryFieldValues_ListEntries_ListEntryId", x => x.ListEntryId, "ListEntries", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_ListEntryFieldValues_ListTypeFields_ListTypeFieldId", x => x.ListTypeFieldId, "ListTypeFields", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PageListAttachments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                PageId = table.Column<Guid>(type: "TEXT", nullable: false),
                ListEntryId = table.Column<Guid>(type: "TEXT", nullable: false),
                SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PageListAttachments", x => x.Id);
                table.ForeignKey("FK_PageListAttachments_ListEntries_ListEntryId", x => x.ListEntryId, "ListEntries", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_PageListAttachments_Pages_PageId", x => x.PageId, "Pages", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PageMindMapAttachments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                PageId = table.Column<Guid>(type: "TEXT", nullable: false),
                MindMapId = table.Column<Guid>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PageMindMapAttachments", x => x.Id);
                table.ForeignKey("FK_PageMindMapAttachments_MindMaps_MindMapId", x => x.MindMapId, "MindMaps", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_PageMindMapAttachments_Pages_PageId", x => x.PageId, "Pages", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PageSummaries",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                PageId = table.Column<Guid>(type: "TEXT", nullable: false),
                Summary = table.Column<string>(type: "TEXT", nullable: false),
                GeneratedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PageSummaries", x => x.Id);
                table.ForeignKey("FK_PageSummaries_Pages_PageId", x => x.PageId, "Pages", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(name: "IX_EntityTags_TagId", table: "EntityTags", column: "TagId");
        migrationBuilder.CreateIndex(name: "IX_ListEntries_ListTypeId", table: "ListEntries", column: "ListTypeId");
        migrationBuilder.CreateIndex(name: "IX_ListEntryFieldValues_ListEntryId", table: "ListEntryFieldValues", column: "ListEntryId");
        migrationBuilder.CreateIndex(name: "IX_ListEntryFieldValues_ListTypeFieldId", table: "ListEntryFieldValues", column: "ListTypeFieldId");
        migrationBuilder.CreateIndex(name: "IX_ListTypeFields_ListTypeId", table: "ListTypeFields", column: "ListTypeId");
        migrationBuilder.CreateIndex(name: "IX_ListTypes_PublicSlug", table: "ListTypes", column: "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex(name: "IX_MindMapNodes_MindMapId", table: "MindMapNodes", column: "MindMapId");
        migrationBuilder.CreateIndex(name: "IX_MindMapNodes_ParentNodeId", table: "MindMapNodes", column: "ParentNodeId");
        migrationBuilder.CreateIndex(name: "IX_MindMaps_PublicSlug", table: "MindMaps", column: "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex(name: "IX_Notebooks_ShelfId", table: "Notebooks", column: "ShelfId");
        migrationBuilder.CreateIndex(name: "IX_Notes_PublicSlug", table: "Notes", column: "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex(name: "IX_PageListAttachments_ListEntryId", table: "PageListAttachments", column: "ListEntryId");
        migrationBuilder.CreateIndex(name: "IX_PageListAttachments_PageId", table: "PageListAttachments", column: "PageId");
        migrationBuilder.CreateIndex(name: "IX_PageMindMapAttachments_MindMapId", table: "PageMindMapAttachments", column: "MindMapId");
        migrationBuilder.CreateIndex(name: "IX_PageMindMapAttachments_PageId", table: "PageMindMapAttachments", column: "PageId");
        migrationBuilder.CreateIndex(name: "IX_Pages_NotebookId", table: "Pages", column: "NotebookId");
        migrationBuilder.CreateIndex(name: "IX_Pages_PublicSlug", table: "Pages", column: "PublicSlug", unique: true, filter: "\"PublicSlug\" IS NOT NULL");
        migrationBuilder.CreateIndex(name: "IX_PageSummaries_PageId", table: "PageSummaries", column: "PageId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_Tags_Name", table: "Tags", column: "Name", unique: true);
        migrationBuilder.CreateIndex(name: "IX_UserApiKeys_UserId", table: "UserApiKeys", column: "UserId");
        migrationBuilder.CreateIndex(name: "IX_Users_Email", table: "Users", column: "Email", unique: true);

        migrationBuilder.Sql(@"CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(entity_type, entity_id, title, tags, summary, content, tokenize='porter ascii');");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS search_index;");
        migrationBuilder.DropTable(name: "EntityTags");
        migrationBuilder.DropTable(name: "FollowUps");
        migrationBuilder.DropTable(name: "ListEntryFieldValues");
        migrationBuilder.DropTable(name: "Notes");
        migrationBuilder.DropTable(name: "PageListAttachments");
        migrationBuilder.DropTable(name: "PageMindMapAttachments");
        migrationBuilder.DropTable(name: "PageSummaries");
        migrationBuilder.DropTable(name: "Tags");
        migrationBuilder.DropTable(name: "UserApiKeys");
        migrationBuilder.DropTable(name: "ListTypeFields");
        migrationBuilder.DropTable(name: "ListEntries");
        migrationBuilder.DropTable(name: "MindMapNodes");
        migrationBuilder.DropTable(name: "Pages");
        migrationBuilder.DropTable(name: "Users");
        migrationBuilder.DropTable(name: "ListTypes");
        migrationBuilder.DropTable(name: "MindMaps");
        migrationBuilder.DropTable(name: "Notebooks");
        migrationBuilder.DropTable(name: "Shelves");
    }
}
