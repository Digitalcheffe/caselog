using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Caselog.Api.Middleware;

public sealed class ApiRequestResponseLoggingMiddleware(RequestDelegate next, ILogger<ApiRequestResponseLoggingMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var requestBody = await ReadRequestBodyAsync(context.Request);

        var originalBody = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;

        Exception? pipelineException = null;

        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            pipelineException = ex;
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            if (!context.Response.HasStarted)
            {
                context.Response.ContentType = "text/plain";
                await context.Response.WriteAsync("An internal server error occurred.");
            }
        }

        stopwatch.Stop();

        responseBuffer.Position = 0;
        var responseBody = await new StreamReader(responseBuffer).ReadToEndAsync();
        responseBuffer.Position = 0;
        await responseBuffer.CopyToAsync(originalBody);
        context.Response.Body = originalBody;

        LogRequest(context, stopwatch.ElapsedMilliseconds, pipelineException, requestBody, responseBody);

    }

    private void LogRequest(HttpContext context, long elapsedMs, Exception? pipelineException, string requestBody, string responseBody)
    {
        var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        var method = context.Request.Method;
        var path = context.Request.Path + context.Request.QueryString;
        var statusCode = context.Response.StatusCode;

        var suffix = string.Empty;
        if (statusCode == StatusCodes.Status401Unauthorized)
        {
            suffix = " [UNAUTH]";
        }
        else if (pipelineException is not null)
        {
            suffix = $" [ERROR: {pipelineException.Message}]";
        }
        else if (statusCode >= 500)
        {
            var responseMessage = string.IsNullOrWhiteSpace(responseBody)
                ? "Internal Server Error"
                : responseBody.Split("\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault() ?? "Internal Server Error";
            suffix = $" [ERROR: {responseMessage}]";
        }

        logger.LogInformation("[{Timestamp}] → {Method} {Path} {StatusCode} {ElapsedMs}ms{Suffix}",
            timestamp,
            method,
            path,
            statusCode,
            elapsedMs,
            suffix);

        if (statusCode >= 400)
        {
            var redactedRequest = RedactSensitiveContent(requestBody);
            logger.LogWarning("  Request Body: {RequestBody}\n  Response Body: {ResponseBody}",
                string.IsNullOrWhiteSpace(redactedRequest) ? "<empty>" : redactedRequest,
                string.IsNullOrWhiteSpace(responseBody) ? "<empty>" : responseBody);
        }

        if (pipelineException is not null)
        {
            logger.LogError(pipelineException, "Unhandled exception while processing {Method} {Path}", method, path);
        }
    }

    private static async Task<string> ReadRequestBodyAsync(HttpRequest request)
    {
        request.EnableBuffering();

        using var reader = new StreamReader(request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        return body;
    }

    private static string RedactSensitiveContent(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return body;
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            var redacted = RedactJsonElement(document.RootElement);
            return JsonSerializer.Serialize(redacted, JsonOptions);
        }
        catch
        {
            return body;
        }
    }

    private static object? RedactJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.EnumerateObject().ToDictionary(
                property => property.Name,
                property => IsSensitiveKey(property.Name)
                    ? "[REDACTED]"
                    : RedactJsonElement(property.Value)),
            JsonValueKind.Array => element.EnumerateArray().Select(RedactJsonElement).ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var longValue) ? longValue : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText()
        };
    }

    private static bool IsSensitiveKey(string key)
    {
        return key.Contains("password", StringComparison.OrdinalIgnoreCase)
               || key.Contains("secret", StringComparison.OrdinalIgnoreCase)
               || key.Contains("token", StringComparison.OrdinalIgnoreCase);
    }
}
