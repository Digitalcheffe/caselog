namespace Caselog.Api.Data.Entities;

public enum Visibility { Private, Internal, Public }
public enum UserRole { Admin, Member }
public enum ListFieldType { Text, Number, Boolean, Date, Select }

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string? TwoFactorSecret { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsDisabled { get; set; }
    public ICollection<UserApiKey> ApiKeys { get; set; } = new List<UserApiKey>();
}

public class UserApiKey
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string KeyHash { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public User User { get; set; } = null!;
}

public class Kase
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Log> Logs { get; set; } = new List<Log>();
}

public class Log
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? KaseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public Visibility Visibility { get; set; }
    public string? PublicSlug { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsFollowUp { get; set; }
    public DateTime? FollowUpDueAt { get; set; }
    public Kase? Kase { get; set; }
}

public class Tag { public Guid Id { get; set; } public string Name { get; set; } = string.Empty; public ICollection<EntityTag> EntityTags { get; set; } = new List<EntityTag>(); }
public class EntityTag { public string EntityType { get; set; } = string.Empty; public Guid EntityId { get; set; } public Guid TagId { get; set; } public Tag Tag { get; set; } = null!; }

public class ListType
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Visibility Visibility { get; set; }
    public string? PublicSlug { get; set; }
    public DateTime CreatedAt { get; set; }
    public ICollection<ListTypeField> Fields { get; set; } = new List<ListTypeField>();
    public ICollection<ListEntry> Entries { get; set; } = new List<ListEntry>();
}

public class ListTypeField { public Guid Id { get; set; } public Guid ListTypeId { get; set; } public string FieldName { get; set; } = string.Empty; public ListFieldType FieldType { get; set; } public bool Required { get; set; } public int SortOrder { get; set; } public ListType ListType { get; set; } = null!; }
public class ListEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ListTypeId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ListType ListType { get; set; } = null!;
    public ICollection<ListEntryFieldValue> FieldValues { get; set; } = new List<ListEntryFieldValue>();
}

public class MindMap
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public Visibility Visibility { get; set; }
    public string? PublicSlug { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class MindMapNode { public Guid Id { get; set; } public Guid MindMapId { get; set; } public Guid? ParentNodeId { get; set; } public string Label { get; set; } = string.Empty; public string? Notes { get; set; } public int SortOrder { get; set; } }
public class Note { public Guid Id { get; set; } public Guid UserId { get; set; } public string? EntityType { get; set; } public Guid? EntityId { get; set; } public string Content { get; set; } = string.Empty; public Visibility Visibility { get; set; } public string? PublicSlug { get; set; } public DateTime CreatedAt { get; set; } public DateTime UpdatedAt { get; set; } }
public class FollowUp { public Guid Id { get; set; } public Guid UserId { get; set; } public string EntityType { get; set; } = string.Empty; public Guid EntityId { get; set; } public string Note { get; set; } = string.Empty; public DateTime CreatedAt { get; set; } public DateTime? ClearedAt { get; set; } }
public class ListEntryFieldValue
{
    public Guid Id { get; set; }
    public Guid ListEntryId { get; set; }
    public Guid ListTypeFieldId { get; set; }
    public string Value { get; set; } = string.Empty;
    public ListEntry ListEntry { get; set; } = null!;
    public ListTypeField ListTypeField { get; set; } = null!;
}
