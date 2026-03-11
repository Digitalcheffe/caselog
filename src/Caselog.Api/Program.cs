using Caselog.Api.Authentication;
using Caselog.Api.Data;
using Caselog.Api.Data.Entities;
using Caselog.Api.Middleware;
using Caselog.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using System.Text.Json;
using System.Text.Json.Serialization;
using Serilog;
using Serilog.Events;
using SerilogLog = Serilog.Log;
using MsLogger = Microsoft.Extensions.Logging.ILogger;
using SerilogLogger = Serilog.ILogger;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("CASELOG_PORT") ?? "5000";
var configuredDbPath = Environment.GetEnvironmentVariable("CASELOG_DB_PATH");
var dataPath = configuredDbPath
    ?? Environment.GetEnvironmentVariable("CASELOG_DATA_PATH")
    ?? "/data/caselog.db";
var listeningUrl = $"http://0.0.0.0:{port}";

var logFilePath = GetLogFilePath(configuredDbPath);
var logDirectory = Path.GetDirectoryName(logFilePath);
if (!string.IsNullOrWhiteSpace(logDirectory))
{
    Directory.CreateDirectory(logDirectory);
}

SerilogLogger configuredLogger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
    .WriteTo.File(
        path: logFilePath,
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        restrictedToMinimumLevel: LogEventLevel.Debug)
    .CreateLogger();

SerilogLog.Logger = configuredLogger;

builder.Host.UseSerilog();

var dataDirectory = Path.GetDirectoryName(dataPath);
if (!string.IsNullOrWhiteSpace(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

builder.WebHost.UseUrls(listeningUrl);
builder.Services.AddDbContext<CaselogDbContext>(options =>
    options.UseSqlite($"Data Source={dataPath}"));

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddSingleton<LoginRateLimiter>();
builder.Services.AddSingleton<TotpService>();
builder.Services.AddScoped<SmtpEmailService>();

var jwtTokenService = new JwtTokenService(builder.Configuration);

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtAuthenticationDefaults.CombinedScheme;
        options.DefaultChallengeScheme = JwtAuthenticationDefaults.CombinedScheme;
    })
    .AddPolicyScheme(JwtAuthenticationDefaults.CombinedScheme, JwtAuthenticationDefaults.CombinedScheme, options =>
    {
        options.ForwardDefaultSelector = context =>
        {
            if (!context.Request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                return ApiKeyAuthenticationDefaults.Scheme;
            }

            var value = authHeader.ToString();
            if (value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var token = value["Bearer ".Length..].Trim();
                return token.Count(c => c == '.') == 2
                    ? JwtBearerDefaults.AuthenticationScheme
                    : ApiKeyAuthenticationDefaults.Scheme;
            }

            return ApiKeyAuthenticationDefaults.Scheme;
        };
    })
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.TokenValidationParameters = jwtTokenService.GetValidationParameters();
    })
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyAuthenticationDefaults.Scheme, _ => { });

builder.Services.AddAuthorization();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<LogSearchIndexService>();
builder.Services.AddScoped<NoteSearchIndexService>();
builder.Services.AddScoped<TaggingService>();
builder.Services.AddScoped<ListEntrySearchIndexService>();
builder.Services.AddScoped<MindMapSearchIndexService>();

var app = builder.Build();

var requiredTables = new[] { "Users", "UserApiKeys", "Kases", "Logs", "ListTypes", "ListFields", "ListEntries", "MindMaps", "MindMapNodes", "Notes", "Tags", "EntityTags" };

var startupChecks = new StartupChecks(
    dataPath,
    DbFileExists: false,
    DbFileSize: null,
    DbConnectionOk: false,
    JwtConfigured: !string.IsNullOrWhiteSpace(builder.Configuration["CASELOG_JWT_SECRET"]),
    SmtpConfigured: !string.IsNullOrWhiteSpace(builder.Configuration["CASELOG_SMTP_HOST"]) && !string.IsNullOrWhiteSpace(builder.Configuration["CASELOG_SMTP_FROM"]),
    MigrationCount: 0,
    AppliedMigrationCount: 0,
    PendingMigrationCount: 0,
    SearchIndexReady: false,
    SearchIndexType: null);

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaselogDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<Program>>();

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

    await ApplyMigrationsWithRecoveryAsync(dbContext, logger, dataPath, pendingMigrations, requiredTables);

    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");

    var appliedMigrations = (await dbContext.Database.GetAppliedMigrationsAsync()).OrderBy(x => x).ToArray();
    var searchIndexMetadata = await EnsureSearchIndexTableAsync(dbContext, logger);

    startupChecks = startupChecks with
    {
        DbConnectionOk = await dbContext.Database.CanConnectAsync(),
        MigrationCount = allMigrations.Length,
        AppliedMigrationCount = appliedMigrations.Length,
        PendingMigrationCount = pendingMigrations.Length,
        SearchIndexReady = searchIndexMetadata.Exists,
        SearchIndexType = searchIndexMetadata.Type
    };

    var missingTables = await GetMissingRequiredTablesAsync(dbContext, requiredTables);
    if (missingTables.Count > 0)
    {
        throw new InvalidOperationException(
            $"Database migration completed but required tables are missing: {string.Join(", ", missingTables)}. " +
            "This usually means runtime migrations were not discovered or do not match the runtime model.");
    }

    ValidateSearchIndex(searchIndexMetadata);

    if (!await dbContext.Users.AnyAsync())
    {
        var createdAt = DateTime.UtcNow;
        var defaultApiKey = ApiKeyHasher.GenerateApiKey();

        var adminUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin@caselog.local",
            PasswordHash = PasswordHasher.Hash("ChangeMe123!"),
            Role = UserRole.Admin,
            CreatedAt = createdAt,
            IsDisabled = false
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
        logger.LogWarning("Password: ChangeMe123! (rotate immediately)");
        logger.LogWarning("API Key (shown once): {ApiKey}", defaultApiKey);
        logger.LogWarning("Store this key securely. It will not be shown again.");
        logger.LogWarning("========================================================");
    }
}

if (File.Exists(dataPath))
{
    var info = new FileInfo(dataPath);
    startupChecks = startupChecks with
    {
        DbFileExists = true,
        DbFileSize = info.Length
    };
}

LogStartupBanner(app.Logger, startupChecks, listeningUrl);

static async Task ApplyMigrationsWithRecoveryAsync(
    CaselogDbContext dbContext,
    MsLogger logger,
    string dataPath,
    string[] pendingMigrations,
    string[] requiredTables)
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

    var missingTablesAfterMigrate = await GetMissingRequiredTablesAsync(dbContext, requiredTables);
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
        "Detected migration history entries without domain tables. Recreating SQLite database file and reapplying migrations. AppliedMigrations=[{AppliedMigrations}]",
        string.Join(", ", appliedMigrations));

    await dbContext.DisposeAsync();

    if (File.Exists(dataPath))
    {
        File.Delete(dataPath);
    }

    var recoveryOptions = new DbContextOptionsBuilder<CaselogDbContext>()
        .UseSqlite($"Data Source={dataPath}")
        .Options;

    await using var recoveryDbContext = new CaselogDbContext(recoveryOptions);
    await recoveryDbContext.Database.MigrateAsync();

    var missingTablesAfterRecovery = await GetMissingRequiredTablesAsync(recoveryDbContext, requiredTables);
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

static async Task<(bool Exists, string? Type)> GetSearchIndexMetadataAsync(CaselogDbContext dbContext)
{
    await using var connection = dbContext.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
    {
        await connection.OpenAsync();
    }

    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT type FROM sqlite_master WHERE name = 'search_index' LIMIT 1;";

    var value = await command.ExecuteScalarAsync();
    return value is null or DBNull ? (false, null) : (true, value.ToString());
}

static void ValidateSearchIndex((bool Exists, string? Type) searchIndexMetadata)
{
    if (!searchIndexMetadata.Exists)
    {
        throw new InvalidOperationException("Required search index table 'search_index' is missing after migrations and startup repair.");
    }

    if (!string.Equals(searchIndexMetadata.Type, "virtual", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException($"Search index table exists but is not an FTS virtual table after startup repair. Type={searchIndexMetadata.Type ?? "unknown"}.");
    }
}

static async Task<(bool Exists, string? Type)> EnsureSearchIndexTableAsync(CaselogDbContext dbContext, MsLogger logger)
{
    var metadata = await GetSearchIndexMetadataAsync(dbContext);
    if (string.Equals(metadata.Type, "virtual", StringComparison.OrdinalIgnoreCase))
    {
        logger.LogInformation("Search index check: search_index is healthy (type=virtual).");
        return metadata;
    }

    if (!metadata.Exists)
    {
        logger.LogWarning("Search index check: search_index is missing. Creating FTS5 virtual table.");
        await CreateSearchIndexVirtualTableAsync(dbContext);
        var repairedMetadata = await GetSearchIndexMetadataAsync(dbContext);
        logger.LogInformation("Search index repair result: Exists={Exists}; Type={Type}", repairedMetadata.Exists, repairedMetadata.Type);
        return repairedMetadata;
    }

    if (string.Equals(metadata.Type, "table", StringComparison.OrdinalIgnoreCase))
    {
        logger.LogWarning("Search index check: search_index exists as a regular table. Starting in-place repair to FTS5 virtual table.");
        await RepairLegacySearchIndexTableAsync(dbContext, logger);
        var repairedMetadata = await GetSearchIndexMetadataAsync(dbContext);
        logger.LogInformation("Search index repair result: Exists={Exists}; Type={Type}", repairedMetadata.Exists, repairedMetadata.Type);
        return repairedMetadata;
    }

    logger.LogError("Search index check: unsupported object type for search_index. Type={Type}", metadata.Type);
    return metadata;
}

static async Task CreateSearchIndexVirtualTableAsync(CaselogDbContext dbContext)
{
    await dbContext.Database.ExecuteSqlRawAsync("""
        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
          entity_type,
          entity_id,
          title,
          content,
          tags,
          summary
        );
        """);
}

static async Task RepairLegacySearchIndexTableAsync(CaselogDbContext dbContext, MsLogger logger)
{
    var existingColumns = await GetSearchIndexColumnsAsync(dbContext);
    var hasMandatoryColumns = existingColumns.Contains("entity_type") && existingColumns.Contains("entity_id");

    if (!hasMandatoryColumns)
    {
        logger.LogWarning(
            "Legacy search_index table is incompatible (missing mandatory columns). Recreating FTS table without data migration. ExistingColumns=[{Columns}]",
            string.Join(", ", existingColumns.OrderBy(x => x)));

        await dbContext.Database.ExecuteSqlRawAsync("DROP TABLE IF EXISTS search_index;");
        await CreateSearchIndexVirtualTableAsync(dbContext);
        return;
    }

    var selectEntityType = existingColumns.Contains("entity_type") ? "entity_type" : "NULL";
    var selectEntityId = existingColumns.Contains("entity_id") ? "entity_id" : "NULL";
    var selectTitle = existingColumns.Contains("title") ? "title" : "NULL";
    var selectContent = existingColumns.Contains("content") ? "content" : "NULL";
    var selectTags = existingColumns.Contains("tags") ? "tags" : "NULL";
    var selectSummary = existingColumns.Contains("summary") ? "summary" : "NULL";

    await dbContext.Database.ExecuteSqlRawAsync("DROP TABLE IF EXISTS search_index_repair;");
    await dbContext.Database.ExecuteSqlRawAsync("""
        CREATE VIRTUAL TABLE search_index_repair USING fts5(
          entity_type,
          entity_id,
          title,
          content,
          tags,
          summary
        );
        """);

    await dbContext.Database.ExecuteSqlRawAsync($"""
        INSERT INTO search_index_repair(entity_type, entity_id, title, content, tags, summary)
        SELECT
            {selectEntityType},
            {selectEntityId},
            {selectTitle},
            {selectContent},
            {selectTags},
            {selectSummary}
        FROM search_index;
        """);

    await dbContext.Database.ExecuteSqlRawAsync("DROP TABLE search_index;");
    await CreateSearchIndexVirtualTableAsync(dbContext);
    await dbContext.Database.ExecuteSqlRawAsync("""
        INSERT INTO search_index(entity_type, entity_id, title, content, tags, summary)
        SELECT entity_type, entity_id, title, content, tags, summary
        FROM search_index_repair;
        """);
    await dbContext.Database.ExecuteSqlRawAsync("DROP TABLE search_index_repair;");

    logger.LogInformation("Legacy search_index table repaired to FTS5 while preserving compatible data.");
}

static async Task<HashSet<string>> GetSearchIndexColumnsAsync(CaselogDbContext dbContext)
{
    await using var connection = dbContext.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
    {
        await connection.OpenAsync();
    }

    await using var command = connection.CreateCommand();
    command.CommandText = "PRAGMA table_info('search_index');";

    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        if (!reader.IsDBNull(1))
        {
            columns.Add(reader.GetString(1));
        }
    }

    return columns;
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

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Caselog API v1");
    options.RoutePrefix = "swagger";
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseMiddleware<ApiRequestResponseLoggingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapFallbackToFile("index.html");

app.Run();

static string GetLogFilePath(string? configuredDbPath)
{
    var dbPath = string.IsNullOrWhiteSpace(configuredDbPath) ? "/data/caselog.db" : configuredDbPath;
    var dbDirectory = Path.GetDirectoryName(dbPath);
    var logsDirectory = string.IsNullOrWhiteSpace(dbDirectory)
        ? "/data/logs"
        : Path.Combine(dbDirectory, "logs");

    return Path.Combine(logsDirectory, "caselog-.log");
}

static void LogStartupBanner(Microsoft.Extensions.Logging.ILogger logger, StartupChecks checks, string listeningUrl)
{
    var assembly = typeof(Program).Assembly;
    var appName = assembly.GetName().Name ?? "Caselog.Api";
    var version = assembly.GetName().Version?.ToString() ?? "unknown";
    var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
    var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

    var dbStatus = checks.DbFileExists
        ? $"exists, {FormatFileSize(checks.DbFileSize ?? 0)}"
        : "missing";
    var dbConnectStatus = checks.DbConnectionOk ? "✓ OK" : "✗ FAIL";
    var jwtStatus = checks.JwtConfigured ? "✓ configured" : "✗ not configured";
    var smtpStatus = checks.SmtpConfigured ? "✓ configured" : "✗ not configured";
    var migrationStatus = $"{checks.AppliedMigrationCount}/{checks.MigrationCount} applied, {checks.PendingMigrationCount} pending";
    var searchStatus = checks.SearchIndexReady ? $"✓ ready ({checks.SearchIndexType ?? "unknown"})" : "✗ missing";

    logger.LogInformation("═══════════════════════════════════════");
    logger.LogInformation("  {AppName} STARTUP — {Timestamp}", appName.ToUpperInvariant(), timestamp);
    logger.LogInformation("═══════════════════════════════════════");
    logger.LogInformation("  Version    : {Version}", version);
    logger.LogInformation("  Environment: {EnvironmentName}", environmentName);
    logger.LogInformation("  DB Path    : {DbPath} ({DbStatus})", checks.DbPath, dbStatus);
    logger.LogInformation("  DB Connect : {DbConnectStatus}", dbConnectStatus);
    logger.LogInformation("  JWT Secret : {JwtStatus}", jwtStatus);
    logger.LogInformation("  SMTP       : {SmtpStatus}", smtpStatus);
    logger.LogInformation("  Migrations : {MigrationStatus}", migrationStatus);
    logger.LogInformation("  Search FTS : {SearchStatus}", searchStatus);
    logger.LogInformation("  Listening  : {ListeningUrl}", listeningUrl);
    logger.LogInformation("═══════════════════════════════════════");
}

static string FormatFileSize(long bytes)
{
    const double kb = 1024;
    const double mb = kb * 1024;
    const double gb = mb * 1024;

    if (bytes >= gb)
    {
        return $"{bytes / gb:0.##}GB";
    }

    if (bytes >= mb)
    {
        return $"{bytes / mb:0.##}MB";
    }

    if (bytes >= kb)
    {
        return $"{bytes / kb:0.##}KB";
    }

    return $"{bytes}B";
}

internal record StartupChecks(
    string DbPath,
    bool DbFileExists,
    long? DbFileSize,
    bool DbConnectionOk,
    bool JwtConfigured,
    bool SmtpConfigured,
    int MigrationCount,
    int AppliedMigrationCount,
    int PendingMigrationCount,
    bool SearchIndexReady,
    string? SearchIndexType);
