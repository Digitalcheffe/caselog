using Caselog.Api.Authentication;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("CASELOG_PORT") ?? "5000";
var dataPath = Environment.GetEnvironmentVariable("CASELOG_DB_PATH")
    ?? Environment.GetEnvironmentVariable("CASELOG_DATA_PATH")
    ?? "/data/caselog.db";

var dataDirectory = Path.GetDirectoryName(dataPath);
if (!string.IsNullOrWhiteSpace(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddDbContext<CaselogDbContext>(options =>
    options.UseSqlite($"Data Source={dataPath}",
        sqliteOptions => sqliteOptions.MigrationsAssembly(typeof(CaselogDbContext).Assembly.GetName().Name)));

builder.Services
    .AddAuthentication(ApiKeyAuthenticationDefaults.Scheme)
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyAuthenticationDefaults.Scheme, _ => { });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddScoped<PageSearchIndexService>();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaselogDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    var migrationsAssembly = dbContext.GetService<IMigrationsAssembly>();
    var allMigrations = migrationsAssembly.Migrations.Keys.OrderBy(x => x).ToArray();
    var pendingMigrations = (await dbContext.Database.GetPendingMigrationsAsync()).OrderBy(x => x).ToArray();

    logger.LogInformation("SQLite startup diagnostics: DataPath={DataPath}; Context={Context}; Provider={Provider}; MigrationsAssembly={MigrationsAssembly}; VisibleMigrations=[{VisibleMigrations}]; PendingMigrations=[{PendingMigrations}]",
        dataPath,
        dbContext.GetType().FullName,
        dbContext.Database.ProviderName,
        migrationsAssembly.Assembly.GetName().Name,
        string.Join(", ", allMigrations),
        string.Join(", ", pendingMigrations));

    if (allMigrations.Length == 0)
    {
        throw new InvalidOperationException(
            "No EF Core migrations were discovered at runtime. " +
            "Cannot initialize schema safely. Ensure migrations are committed and published with the API assembly.");
    }

    await ApplyMigrationsWithRecoveryAsync(dbContext, logger, dataPath, pendingMigrations, allMigrations);

    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");

    var missingTables = await GetMissingRequiredTablesAsync(dbContext, ["Users", "UserApiKeys"]);
    if (missingTables.Count > 0)
    {
        throw new InvalidOperationException(
            $"Database migration completed but required tables are missing: {string.Join(", ", missingTables)}. " +
            "This usually means runtime migrations were not discovered or do not match the runtime model.");
    }

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

static async Task ApplyMigrationsWithRecoveryAsync(
    CaselogDbContext dbContext,
    ILogger logger,
    string dataPath,
    string[] pendingMigrations,
    string[] allMigrations)
{
    try
    {
        await dbContext.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex,
            "Failed to apply EF Core migrations. DataPath={DataPath}; PendingMigrations=[{PendingMigrations}]",
            dataPath,
            string.Join(", ", pendingMigrations));
        throw;
    }

    var missingTablesAfterMigrate = await GetMissingRequiredTablesAsync(dbContext, ["Users", "UserApiKeys"]);
    if (missingTablesAfterMigrate.Count == 0)
    {
        return;
    }

    var appliedMigrations = (await dbContext.Database.GetAppliedMigrationsAsync()).ToArray();
    if (appliedMigrations.Length == 0)
    {
        return;
    }

    var existingTables = await GetExistingTableNamesAsync(dbContext);
    var hasDomainTables = existingTables.Any(name => !string.Equals(name, "__EFMigrationsHistory", StringComparison.OrdinalIgnoreCase));
    if (hasDomainTables)
    {
        return;
    }

    logger.LogWarning(
        "Detected migration history entries without domain tables. Rebuilding __EFMigrationsHistory and reapplying all migrations. AppliedMigrations=[{AppliedMigrations}]",
        string.Join(", ", appliedMigrations));

    await dbContext.Database.ExecuteSqlRawAsync("DELETE FROM \"__EFMigrationsHistory\";");

    if (allMigrations.Length == 0)
    {
        throw new InvalidOperationException(
            "Migrations recovery was requested but no runtime migrations were discovered.");
    }

    await dbContext.Database.MigrateAsync();

    var missingTablesAfterRecovery = await GetMissingRequiredTablesAsync(dbContext, ["Users", "UserApiKeys"]);
    if (missingTablesAfterRecovery.Count > 0)
    {
        throw new InvalidOperationException(
            $"Failed to rebuild schema from migrations. Required tables are still missing: {string.Join(", ", missingTablesAfterRecovery)}.");
    }
}


static async Task<List<string>> GetMissingRequiredTablesAsync(CaselogDbContext dbContext, string[] requiredTableNames)
{
    var existingTables = await GetExistingTableNamesAsync(dbContext);
    return requiredTableNames.Where(name => !existingTables.Contains(name)).ToList();
}

static async Task<HashSet<string>> GetExistingTableNamesAsync(CaselogDbContext dbContext)
{
    await using var connection = dbContext.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
    {
        await connection.OpenAsync();
    }

    await using var command = connection.CreateCommand();
    command.CommandText =
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';";

    var existingTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        if (!reader.IsDBNull(0))
        {
            existingTables.Add(reader.GetString(0));
        }
    }

    return existingTables;
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

app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/public/{**slug}", (string slug) => Results.NotFound(new { slug }));

app.MapFallbackToFile("index.html");

app.Run();
