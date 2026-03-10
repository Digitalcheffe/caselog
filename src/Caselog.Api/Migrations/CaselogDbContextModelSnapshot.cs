using System;
using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Caselog.Api.Migrations;

[DbContext(typeof(CaselogDbContext))]
partial class CaselogDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity("Caselog.Api.Data.Entities.EntityTag", b =>
        {
            b.Property<string>("EntityType");
            b.Property<Guid>("EntityId");
            b.Property<Guid>("TagId");
            b.HasKey("EntityType", "EntityId", "TagId");
            b.HasIndex("TagId");
            b.ToTable("EntityTags");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.FollowUp", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime?>("ClearedAt");
            b.Property<DateTime>("CreatedAt");
            b.Property<Guid>("EntityId");
            b.Property<string>("EntityType");
            b.Property<string>("Note");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.ToTable("FollowUps");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListEntry", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<Guid>("ListTypeId");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.HasIndex("ListTypeId");
            b.ToTable("ListEntries");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListEntryFieldValue", b =>
        {
            b.Property<Guid>("Id");
            b.Property<Guid>("ListEntryId");
            b.Property<Guid>("ListTypeFieldId");
            b.Property<string>("Value");
            b.HasKey("Id");
            b.HasIndex("ListEntryId");
            b.HasIndex("ListTypeFieldId");
            b.ToTable("ListEntryFieldValues");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListType", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("Description");
            b.Property<string>("Name");
            b.Property<string>("PublicSlug");
            b.Property<Guid>("UserId");
            b.Property<string>("Visibility");
            b.HasKey("Id");
            b.HasIndex("PublicSlug").IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            b.ToTable("ListTypes");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListTypeField", b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("FieldName");
            b.Property<string>("FieldType");
            b.Property<Guid>("ListTypeId");
            b.Property<bool>("Required");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.HasIndex("ListTypeId");
            b.ToTable("ListTypeFields");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.MindMap", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("PublicSlug");
            b.Property<string>("Title");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.Property<string>("Visibility");
            b.HasKey("Id");
            b.HasIndex("PublicSlug").IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            b.ToTable("MindMaps");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.MindMapNode", b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Label");
            b.Property<Guid>("MindMapId");
            b.Property<string>("Notes");
            b.Property<Guid?>("ParentNodeId");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.HasIndex("MindMapId");
            b.HasIndex("ParentNodeId");
            b.ToTable("MindMapNodes");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Note", b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Content");
            b.Property<DateTime>("CreatedAt");
            b.Property<Guid?>("EntityId");
            b.Property<string>("EntityType");
            b.Property<string>("PublicSlug");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.Property<string>("Visibility");
            b.HasKey("Id");
            b.HasIndex("PublicSlug").IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            b.ToTable("Notes");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Notebook", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("Description");
            b.Property<string>("Name");
            b.Property<Guid?>("ShelfId");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.HasIndex("ShelfId");
            b.ToTable("Notebooks");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Page", b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Content");
            b.Property<DateTime>("CreatedAt");
            b.Property<Guid?>("NotebookId");
            b.Property<string>("PublicSlug");
            b.Property<string>("Title");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.Property<string>("Visibility");
            b.HasKey("Id");
            b.HasIndex("NotebookId");
            b.HasIndex("PublicSlug").IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            b.ToTable("Pages");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageListAttachment", b =>
        {
            b.Property<Guid>("Id");
            b.Property<Guid>("ListEntryId");
            b.Property<Guid>("PageId");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.HasIndex("ListEntryId");
            b.HasIndex("PageId");
            b.ToTable("PageListAttachments");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageMindMapAttachment", b =>
        {
            b.Property<Guid>("Id");
            b.Property<Guid>("MindMapId");
            b.Property<Guid>("PageId");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.HasIndex("MindMapId");
            b.HasIndex("PageId");
            b.ToTable("PageMindMapAttachments");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageSummary", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("GeneratedAt");
            b.Property<Guid>("PageId");
            b.Property<string>("Summary");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.HasIndex("PageId").IsUnique();
            b.ToTable("PageSummaries");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Shelf", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("Description");
            b.Property<string>("Name");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.ToTable("Shelves");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Tag", b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Name");
            b.HasKey("Id");
            b.HasIndex("Name").IsUnique();
            b.ToTable("Tags");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.User", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("Email");
            b.Property<bool>("IsDisabled");
            b.Property<DateTime?>("LastLoginAt");
            b.Property<string>("PasswordHash");
            b.Property<string>("Role");
            b.Property<bool>("TwoFactorEnabled");
            b.Property<string>("TwoFactorSecret");
            b.HasKey("Id");
            b.HasIndex("Email").IsUnique();
            b.ToTable("Users");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.UserApiKey", b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("KeyHash");
            b.Property<DateTime?>("LastUsedAt");
            b.Property<string>("Label");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.HasIndex("UserId");
            b.ToTable("UserApiKeys");
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.EntityTag", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.Tag", "Tag").WithMany("EntityTags").HasForeignKey("TagId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListEntry", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.ListType", "ListType").WithMany("Entries").HasForeignKey("ListTypeId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListEntryFieldValue", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.ListEntry", "ListEntry").WithMany("FieldValues").HasForeignKey("ListEntryId").OnDelete(DeleteBehavior.Cascade).IsRequired();
            b.HasOne("Caselog.Api.Data.Entities.ListTypeField", "ListTypeField").WithMany("Values").HasForeignKey("ListTypeFieldId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.ListTypeField", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.ListType", "ListType").WithMany("Fields").HasForeignKey("ListTypeId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.MindMapNode", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.MindMap", "MindMap").WithMany("Nodes").HasForeignKey("MindMapId").OnDelete(DeleteBehavior.Cascade).IsRequired();
            b.HasOne("Caselog.Api.Data.Entities.MindMapNode", "ParentNode").WithMany("ChildNodes").HasForeignKey("ParentNodeId").OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Notebook", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.Shelf", "Shelf").WithMany("Notebooks").HasForeignKey("ShelfId").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.Page", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.Notebook", "Notebook").WithMany("Pages").HasForeignKey("NotebookId").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageListAttachment", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.ListEntry", "ListEntry").WithMany().HasForeignKey("ListEntryId").OnDelete(DeleteBehavior.Cascade).IsRequired();
            b.HasOne("Caselog.Api.Data.Entities.Page", "Page").WithMany("ListAttachments").HasForeignKey("PageId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageMindMapAttachment", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.MindMap", "MindMap").WithMany("PageAttachments").HasForeignKey("MindMapId").OnDelete(DeleteBehavior.Cascade).IsRequired();
            b.HasOne("Caselog.Api.Data.Entities.Page", "Page").WithMany("MindMapAttachments").HasForeignKey("PageId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.PageSummary", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.Page", "Page").WithOne("Summary").HasForeignKey("Caselog.Api.Data.Entities.PageSummary", "PageId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });

        modelBuilder.Entity("Caselog.Api.Data.Entities.UserApiKey", b =>
        {
            b.HasOne("Caselog.Api.Data.Entities.User", "User").WithMany("ApiKeys").HasForeignKey("UserId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });
    }
}
