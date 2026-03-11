using System;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Caselog.Api.Migrations;

[DbContext(typeof(CaselogDbContext))]
public partial class CaselogDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

        modelBuilder.Entity<User>(b =>
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

        modelBuilder.Entity<UserApiKey>(b =>
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

        modelBuilder.Entity<Kase>(b =>
        {
            b.Property<Guid>("Id");
            b.Property<DateTime>("CreatedAt");
            b.Property<string>("Description");
            b.Property<string>("Name");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.HasKey("Id");
            b.ToTable("Kases");
        });

        modelBuilder.Entity<Log>(b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Content");
            b.Property<DateTime>("CreatedAt");
            b.Property<DateTime?>("FollowUpDueAt");
            b.Property<bool>("IsFollowUp");
            b.Property<Guid?>("KaseId");
            b.Property<string>("PublicSlug");
            b.Property<string>("Title");
            b.Property<DateTime>("UpdatedAt");
            b.Property<Guid>("UserId");
            b.Property<string>("Visibility");
            b.HasKey("Id");
            b.HasIndex("KaseId");
            b.HasIndex("PublicSlug").IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            b.ToTable("Logs");
        });

        modelBuilder.Entity<Tag>(b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Name");
            b.HasKey("Id");
            b.HasIndex("Name").IsUnique();
            b.ToTable("Tags");
        });

        modelBuilder.Entity<EntityTag>(b =>
        {
            b.Property<string>("EntityType");
            b.Property<Guid>("EntityId");
            b.Property<Guid>("TagId");
            b.HasKey("EntityType", "EntityId", "TagId");
            b.HasIndex("TagId");
            b.ToTable("EntityTags");
        });

        modelBuilder.Entity<ListType>(b =>
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

        modelBuilder.Entity<ListTypeField>(b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("FieldName");
            b.Property<string>("FieldType");
            b.Property<Guid>("ListTypeId");
            b.Property<bool>("Required");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.HasIndex("ListTypeId");
            b.ToTable("ListFields");
        });

        modelBuilder.Entity<ListEntry>(b =>
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

        modelBuilder.Entity<ListEntryFieldValue>(b =>
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

        modelBuilder.Entity<MindMap>(b =>
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

        modelBuilder.Entity<MindMapNode>(b =>
        {
            b.Property<Guid>("Id");
            b.Property<string>("Label");
            b.Property<Guid>("MindMapId");
            b.Property<string>("Notes");
            b.Property<Guid?>("ParentNodeId");
            b.Property<int>("SortOrder");
            b.HasKey("Id");
            b.ToTable("MindMapNodes");
        });

        modelBuilder.Entity<Note>(b =>
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

        modelBuilder.Entity<FollowUp>(b =>
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

        modelBuilder.Entity<SearchIndexEntry>(b =>
        {
            b.Property<string>("Content");
            b.Property<string>("EntityId");
            b.Property<string>("EntityType");
            b.Property<string>("Summary");
            b.Property<string>("Tags");
            b.Property<string>("Title");
            b.ToTable("search_index");
        });
    }
}
