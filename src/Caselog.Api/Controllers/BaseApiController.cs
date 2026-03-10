using System.Security.Claims;
using Caselog.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace Caselog.Api.Controllers;

[ApiController]
public abstract class BaseApiController : ControllerBase
{
    protected Guid GetUserId()
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claimValue, out var userId)
            ? userId
            : throw new InvalidOperationException("Authenticated user id claim is missing.");
    }

    protected ActionResult<ApiEnvelope<object>> NotFoundProblem(string detail)
    {
        var problem = new ProblemDetails
        {
            Type = "https://tools.ietf.org/html/rfc9110#section-15.5.5",
            Title = "Not Found",
            Status = StatusCodes.Status404NotFound,
            Detail = detail,
            Instance = HttpContext.Request.Path
        };

        return NotFound(problem);
    }
}
