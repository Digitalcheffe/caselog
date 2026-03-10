using System.Security.Claims;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Route("api/auth")]
public sealed class AuthController(
    CaselogDbContext dbContext,
    JwtTokenService jwtTokenService,
    LoginRateLimiter loginRateLimiter,
    TotpService totpService) : BaseApiController
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<ApiEnvelope<LoginResponse>>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (loginRateLimiter.IsBlocked(ip))
        {
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid credentials." }));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (user is null || user.IsDisabled || !PasswordHasher.Verify(request.Password, user.PasswordHash))
        {
            loginRateLimiter.RecordFailure(ip);
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid credentials." }));
        }

        loginRateLimiter.Reset(ip);

        if (user.TwoFactorEnabled)
        {
            var partialToken = jwtTokenService.CreatePartialTwoFactorToken(user);
            return Ok(new ApiEnvelope<LoginResponse>(new LoginResponse(true, partialToken)));
        }

        user.LastLoginAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        var token = jwtTokenService.CreateAccessToken(user);
        return Ok(new ApiEnvelope<LoginResponse>(new LoginResponse(false, token)));
    }

    [Authorize]
    [HttpPost("logout")]
    public ActionResult<ApiEnvelope<LogoutResponse>> Logout()
    {
        return Ok(new ApiEnvelope<LogoutResponse>(new LogoutResponse(true)));
    }

    [Authorize]
    [HttpPost("2fa/setup")]
    public async Task<ActionResult<ApiEnvelope<TwoFactorSetupResponse>>> SetupTwoFactor(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var user = await dbContext.Users.SingleAsync(x => x.Id == userId, cancellationToken);
        var secret = totpService.GenerateSecret();
        user.TwoFactorSecret = secret;
        user.TwoFactorEnabled = false;
        await dbContext.SaveChangesAsync(cancellationToken);

        var qrCode = totpService.BuildQrCodeDataUri(user.Email, secret);
        return Ok(new ApiEnvelope<TwoFactorSetupResponse>(new TwoFactorSetupResponse(secret, qrCode)));
    }

    [AllowAnonymous]
    [HttpPost("2fa/verify")]
    public async Task<ActionResult<ApiEnvelope<LoginResponse>>> VerifyTwoFactor([FromBody] TwoFactorVerifyRequest request, CancellationToken cancellationToken)
    {
        User? user = null;
        var authenticatedUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (Guid.TryParse(authenticatedUserId, out var activeUserId))
        {
            user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == activeUserId, cancellationToken);
            if (user is null || string.IsNullOrWhiteSpace(user.TwoFactorSecret) || !totpService.VerifyCode(user.TwoFactorSecret, request.Code))
            {
                return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid authentication code." }));
            }

            user.TwoFactorEnabled = true;
            await dbContext.SaveChangesAsync(cancellationToken);
            var accessToken = jwtTokenService.CreateAccessToken(user);
            return Ok(new ApiEnvelope<LoginResponse>(new LoginResponse(false, accessToken)));
        }

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid authentication code." }));
        }

        var principal = jwtTokenService.ValidatePartialTwoFactorToken(request.Token);
        if (principal is null)
        {
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid authentication code." }));
        }

        var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var partialUserId))
        {
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid authentication code." }));
        }

        user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == partialUserId, cancellationToken);
        if (user is null || user.IsDisabled || !user.TwoFactorEnabled || string.IsNullOrWhiteSpace(user.TwoFactorSecret) || !totpService.VerifyCode(user.TwoFactorSecret, request.Code))
        {
            return Unauthorized(new ApiEnvelope<object>(null, new { message = "Invalid authentication code." }));
        }

        user.LastLoginAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        var token = jwtTokenService.CreateAccessToken(user);
        return Ok(new ApiEnvelope<LoginResponse>(new LoginResponse(false, token)));
    }
}
