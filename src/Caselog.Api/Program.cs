using Caselog.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("CASELOG_PORT") ?? "5000";
var dataPath = Environment.GetEnvironmentVariable("CASELOG_DATA_PATH")
    ?? Path.Combine(builder.Environment.ContentRootPath, "data", "caselog.db");

var dataDirectory = Path.GetDirectoryName(dataPath);
if (!string.IsNullOrWhiteSpace(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddDbContext<CaselogDbContext>(options => options.UseSqlite($"Data Source={dataPath}"));

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaselogDbContext>();
    await dbContext.Database.MigrateAsync();
    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapFallbackToFile("index.html");

app.Run();
