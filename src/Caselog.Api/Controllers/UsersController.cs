using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Models;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Caselog.Api.Controllers;

[Authorize]
[Route("api/users")]
public sealed class UsersController(CaselogDbContext dbContext, SmtpEmailService emailService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<UserResponse>>>> GetUsers(CancellationToken cancellationToken)
    {
        if (!User.IsInRole(UserRole.Admin.ToString()))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiEnvelope<object>(null, new { message = "Forbidden" }));
        }

        var users = await dbContext.Users.AsNoTracking().OrderBy(x => x.Email)
            .Select(x => new UserResponse(x.Id, x.Email, x.Role, x.CreatedAt, x.LastLoginAt, x.IsDisabled))
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<IReadOnlyList<UserResponse>>(users));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<UserResponse>>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(UserRole.Admin.ToString()))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiEnvelope<object>(null, new { message = "Forbidden" }));
        }

        var email = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(x => x.Email == email, cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(null, new { message = "User already exists." }));
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = PasswordHasher.Hash(request.Password),
            Role = request.Role,
            CreatedAt = DateTime.UtcNow,
            IsDisabled = false
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        await emailService.SendWelcomeEmailAsync(user.Email, cancellationToken);

        var response = new UserResponse(user.Id, user.Email, user.Role, user.CreatedAt, user.LastLoginAt, user.IsDisabled);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new ApiEnvelope<UserResponse>(response));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<UserResponse>>> GetUser(Guid id, CancellationToken cancellationToken)
    {
        var callerId = GetUserId();
        var isAdmin = User.IsInRole(UserRole.Admin.ToString());
        if (!isAdmin && callerId != id)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiEnvelope<object>(null, new { message = "Forbidden" }));
        }

        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFoundProblem($"User '{id}' was not found.");
        }

        return Ok(new ApiEnvelope<UserResponse>(new UserResponse(user.Id, user.Email, user.Role, user.CreatedAt, user.LastLoginAt, user.IsDisabled)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<UserResponse>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var callerId = GetUserId();
        var isAdmin = User.IsInRole(UserRole.Admin.ToString());
        if (!isAdmin && callerId != id)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiEnvelope<object>(null, new { message = "Forbidden" }));
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFoundProblem($"User '{id}' was not found.");
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            user.Email = request.Email.Trim().ToLowerInvariant();
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = PasswordHasher.Hash(request.Password);
        }

        if (isAdmin)
        {
            if (request.Role.HasValue)
            {
                user.Role = request.Role.Value;
            }

            if (request.IsDisabled.HasValue)
            {
                user.IsDisabled = request.IsDisabled.Value;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<UserResponse>(new UserResponse(user.Id, user.Email, user.Role, user.CreatedAt, user.LastLoginAt, user.IsDisabled)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiEnvelope<object>>> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(UserRole.Admin.ToString()))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiEnvelope<object>(null, new { message = "Forbidden" }));
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFoundProblem($"User '{id}' was not found.");
        }

        user.IsDisabled = true;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiEnvelope<object>(new { disabled = true }));
    }
}
