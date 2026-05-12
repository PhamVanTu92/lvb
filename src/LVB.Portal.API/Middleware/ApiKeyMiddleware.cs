using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.API.Middleware;

/// <summary>
/// Middleware xác thực API Key cho iTitan (header: X-Api-Key)
/// </summary>
public class ApiKeyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiKeyMiddleware> _logger;

    public ApiKeyMiddleware(RequestDelegate next, ILogger<ApiKeyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db, PasswordService passwordService)
    {
        // Only check API key routes (data/latest endpoints for iTitan)
        if (!context.Request.Path.StartsWithSegments("/api/v1/data") ||
            !context.Request.Path.Value!.EndsWith("/latest"))
        {
            await _next(context);
            return;
        }

        // Skip if already authenticated via JWT
        if (context.User.Identity?.IsAuthenticated == true)
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Api-Key", out var apiKeyValue))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { message = "API Key required" });
            return;
        }

        var rawKey = apiKeyValue.ToString();
        var apiKeys = await db.ApiKeys
            .Where(k => k.IsActive && (k.ExpiresAt == null || k.ExpiresAt > DateTime.UtcNow))
            .ToListAsync();

        var matchedKey = apiKeys.FirstOrDefault(k => passwordService.VerifyPassword(rawKey, k.KeyHash));

        if (matchedKey == null)
        {
            _logger.LogWarning("Invalid API key attempt from {IP}", context.Connection.RemoteIpAddress);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { message = "Invalid API Key" });
            return;
        }

        // Update last used
        matchedKey.LastUsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Mark as API-key authenticated via custom claim
        var identity = new System.Security.Claims.ClaimsIdentity("ApiKey");
        identity.AddClaim(new System.Security.Claims.Claim("api_key_name", matchedKey.Name));
        context.User = new System.Security.Claims.ClaimsPrincipal(identity);

        _logger.LogInformation("API Key auth: {KeyName}", matchedKey.Name);
        await _next(context);
    }
}
