using Caselog.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Data;

public class CaselogDbContext(DbContextOptions<CaselogDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserApiKey> UserApiKeys => Set<UserApiKey>();
    public DbSet<Kase> Kases => Set<Kase>();
    public DbSet<Log> Logs => Set<Log>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<EntityTag> EntityTags => Set<EntityTag>();
    public DbSet<ListType> ListTypes => Set<ListType>();
    public DbSet<ListTypeField> ListTypeFields => Set<ListTypeField>();
    public DbSet<ListEntry> ListEntries => Set<ListEntry>();
    public DbSet<MindMap> MindMaps => Set<MindMap>();
    public DbSet<MindMapNode> MindMapNodes => Set<MindMapNode>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<SearchIndexEntry> SearchIndex => Set<SearchIndexEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<SearchIndexEntry>().HasNoKey().ToTable("search_index");
        modelBuilder.Entity<User>().HasIndex(x => x.Email).IsUnique();
        modelBuilder.Entity<User>().Property(x => x.Role).HasConversion<string>();
        modelBuilder.Entity<UserApiKey>().HasOne(x => x.User).WithMany(x => x.ApiKeys).HasForeignKey(x => x.UserId);

        modelBuilder.Entity<Kase>().ToTable("Kases");
        modelBuilder.Entity<Log>().ToTable("Logs");
        modelBuilder.Entity<Log>().Property(x => x.Visibility).HasConversion<string>();
        modelBuilder.Entity<Log>().HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        modelBuilder.Entity<Log>().HasOne(l => l.Kase).WithMany(k => k.Logs).HasForeignKey(l => l.KaseId).IsRequired(false);

        modelBuilder.Entity<Tag>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<EntityTag>().HasKey(x => new { x.EntityType, x.EntityId, x.TagId });
        modelBuilder.Entity<EntityTag>().HasOne(x => x.Tag).WithMany(x => x.EntityTags).HasForeignKey(x => x.TagId);

        modelBuilder.Entity<ListType>().Property(x => x.Visibility).HasConversion<string>();
        modelBuilder.Entity<ListType>().HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        modelBuilder.Entity<ListTypeField>().Property(x => x.FieldType).HasConversion<string>();
        modelBuilder.Entity<ListTypeField>().HasOne(x => x.ListType).WithMany(x => x.Fields).HasForeignKey(x => x.ListTypeId);
        modelBuilder.Entity<ListEntry>().HasOne(x => x.ListType).WithMany(x => x.Entries).HasForeignKey(x => x.ListTypeId);

        modelBuilder.Entity<MindMap>().Property(x => x.Visibility).HasConversion<string>();
        modelBuilder.Entity<MindMap>().HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
        modelBuilder.Entity<Note>().Property(x => x.Visibility).HasConversion<string>();
        modelBuilder.Entity<Note>().HasIndex(x => x.PublicSlug).IsUnique().HasFilter("\"PublicSlug\" IS NOT NULL");
    }
}
