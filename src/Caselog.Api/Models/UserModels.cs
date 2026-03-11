using Caselog.Api.Data.Entities;

namespace Caselog.Api.Models;

public sealed record UserResponse(Guid Id, string FirstName, string LastName, string FullName, string Email, UserRole Role, DateTime CreatedAt, DateTime? LastLoginAt, bool IsDisabled);
public sealed record CreateUserRequest(string Email, string Password, string FirstName, string LastName, UserRole Role = UserRole.Member);
public sealed record UpdateUserRequest(string? Email, string? Password, string? FirstName = null, string? LastName = null, UserRole? Role = null, bool? IsDisabled = null);
