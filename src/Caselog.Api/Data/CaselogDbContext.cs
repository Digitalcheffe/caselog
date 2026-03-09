using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Data;

public class CaselogDbContext(DbContextOptions<CaselogDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserApiKey> UserApiKeys => Set<UserApiKey>();
    public DbSet<Shelf> Shelves => Set<Shelf>();
    public DbSet<Notebook> Notebooks => Set<Notebook>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<EntityTag> EntityTags => Set<EntityTag>();
    public DbSet<ListType> ListTypes => Set<ListType>();
    public DbSet<ListTypeField> ListTypeFields => Set<ListTypeField>();
    public DbSet<ListEntry> ListEntries => Set<ListEntry>();
    public DbSet<ListEntryFieldValue> ListEntryFieldValues => Set<ListEntryFieldValue>();
    public DbSet<PageListAttachment> PageListAttachments => Set<PageListAttachment>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<MindMap> MindMaps => Set<MindMap>();
    public DbSet<MindMapNode> MindMapNodes => Set<MindMapNode>();
    public DbSet<PageMindMapAttachment> PageMindMapAttachments => Set<PageMindMapAttachment>();
    public DbSet<FollowUp> FollowUps => Set<FollowUp>();
    public DbSet<PageSummary> PageSummaries => Set<PageSummary>();
    public DbSet<SearchIndexEntry> SearchIndex => Set<SearchIndexEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<SearchIndexEntry>().HasNoKey().ToTable("search_index");

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.Role).HasConversion<string>();
        });

        modelBuilder.Entity<UserApiKey>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.User).WithMany(x => x.ApiKeys).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Shelf>(entity => entity.HasKey(x => x.Id));

        modelBuilder.Entity<Notebook>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Shelf).WithMany(x => x.Notebooks).HasForeignKey(x => x.ShelfId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Page>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Visibility).HasConversion<string>();
            entity.HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
            entity.HasOne(x => x.Notebook).WithMany(x => x.Pages).HasForeignKey(x => x.NotebookId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<EntityTag>(entity =>
        {
            entity.HasKey(x => new { x.EntityType, x.EntityId, x.TagId });
            entity.HasOne(x => x.Tag).WithMany(x => x.EntityTags).HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ListType>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Visibility).HasConversion<string>();
            entity.HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        });

        modelBuilder.Entity<ListTypeField>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FieldType).HasConversion<string>();
            entity.HasOne(x => x.ListType).WithMany(x => x.Fields).HasForeignKey(x => x.ListTypeId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ListEntry>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.ListType).WithMany(x => x.Entries).HasForeignKey(x => x.ListTypeId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ListEntryFieldValue>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.ListEntry).WithMany(x => x.FieldValues).HasForeignKey(x => x.ListEntryId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ListTypeField).WithMany(x => x.Values).HasForeignKey(x => x.ListTypeFieldId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PageListAttachment>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Page).WithMany(x => x.ListAttachments).HasForeignKey(x => x.PageId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ListEntry).WithMany().HasForeignKey(x => x.ListEntryId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Visibility).HasConversion<string>();
            entity.HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        });

        modelBuilder.Entity<MindMap>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Visibility).HasConversion<string>();
            entity.HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        });

        modelBuilder.Entity<MindMapNode>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.MindMap).WithMany(x => x.Nodes).HasForeignKey(x => x.MindMapId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ParentNode).WithMany(x => x.ChildNodes).HasForeignKey(x => x.ParentNodeId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PageMindMapAttachment>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Page).WithMany(x => x.MindMapAttachments).HasForeignKey(x => x.PageId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.MindMap).WithMany(x => x.PageAttachments).HasForeignKey(x => x.MindMapId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FollowUp>(entity => entity.HasKey(x => x.Id));

        modelBuilder.Entity<PageSummary>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.PageId).IsUnique();
            entity.HasOne(x => x.Page).WithOne(x => x.Summary).HasForeignKey<PageSummary>(x => x.PageId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
