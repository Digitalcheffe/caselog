using System.Text.Json.Serialization;

namespace Caselog.Api.Models;

public sealed record LoginRequest(string Email, string Password);
public sealed record LoginResponse([property: JsonPropertyName("requires2fa")] bool Requires2Fa, string Token);
public sealed record LogoutResponse(bool LoggedOut);
public sealed record TwoFactorSetupResponse(string Secret, string QrCodeDataUri);
public sealed record TwoFactorVerifyRequest(string Code, string? Token = null);
public sealed record AuthMeResponse(Guid Id, string Name, string Email, string Role, bool TwoFactorEnabled);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
