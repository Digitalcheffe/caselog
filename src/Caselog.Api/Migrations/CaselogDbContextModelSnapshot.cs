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
        modelBuilder.HasAnnotation("ProductVersion", "8.0.0");

        modelBuilder.Entity("Caselog.Api.Data.Entities.Kase", b =>
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

        modelBuilder.Entity("Caselog.Api.Data.Entities.Log", b =>
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
            b.ToTable("Logs");
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
    }
}
