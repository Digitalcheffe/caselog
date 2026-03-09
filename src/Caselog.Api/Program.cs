using Caselog.Api.Authentication;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("CASELOG_PORT") ?? "5000";
var dataPath = Environment.GetEnvironmentVariable("CASELOG_DB_PATH") ?? "/data/caselog.db";

var dataDirectory = Path.GetDirectoryName(dataPath);
if (!string.IsNullOrWhiteSpace(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddDbContext<CaselogDbContext>(options =>
    options.UseSqlite($"Data Source={dataPath}",
        b => b.MigrationsAssembly("Caselog.Api")));

builder.Services
    .AddAuthentication(ApiKeyAuthenticationDefaults.Scheme)
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyAuthenticationDefaults.Scheme, _ => { });

builder.Services.AddAuthorization();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaselogDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    await dbContext.Database.MigrateAsync();
    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");

    try
    {
        if (!await dbContext.Users.AnyAsync())
        {
            var createdAt = DateTime.UtcNow;
            var defaultApiKey = ApiKeyHasher.GenerateApiKey();

            var adminUser = new User
            {
                Id = Guid.NewGuid(),
                Email = "admin@caselog.local",
                PasswordHash = string.Empty,
                Role = UserRole.Admin,
                CreatedAt = createdAt
            };

            var adminApiKey = new UserApiKey
            {
                Id = Guid.NewGuid(),
                UserId = adminUser.Id,
                KeyHash = ApiKeyHasher.Hash(defaultApiKey),
                Label = "Initial bootstrap key",
                CreatedAt = createdAt
            };

            dbContext.Users.Add(adminUser);
            dbContext.UserApiKeys.Add(adminApiKey);
            await dbContext.SaveChangesAsync();

            logger.LogWarning("========================================================");
            logger.LogWarning("Caselog default admin account created.");
            logger.LogWarning("Email: {Email}", adminUser.Email);
            logger.LogWarning("API Key (shown once): {ApiKey}", defaultApiKey);
            logger.LogWarning("Store this key securely. It will not be shown again.");
            logger.LogWarning("========================================================");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed while seeding default admin user and API key.");
    }
}

app.UseWhen(
    context => context.Request.Path.StartsWithSegments("/api"),
    branch =>
    {
        branch.Use(async (context, next) =>
        {
            var authenticateResult = await context.AuthenticateAsync(ApiKeyAuthenticationDefaults.Scheme);
            if (authenticateResult.Succeeded && authenticateResult.Principal is not null)
            {
                context.User = authenticateResult.Principal;
                await next();
                return;
            }

            var problem = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                Title = "Unauthorized",
                Status = StatusCodes.Status401Unauthorized,
                Detail = "A valid API key is required in the Authorization header as Bearer token.",
                Instance = context.Request.Path
            };

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(problem);
        });
    });

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/public/{**slug}", (string slug) => Results.NotFound(new { slug }));

app.MapFallbackToFile("index.html");

app.Run();
