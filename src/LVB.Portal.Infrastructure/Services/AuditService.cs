using System.Text.Json;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace LVB.Portal.Infrastructure.Services;

public class AuditService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<AuditService> _logger;

    public AuditService(AppDbContext db, IHttpContextAccessor http, ILogger<AuditService> logger)
    {
        _db = db;
        _http = http;
        _logger = logger;
    }

    public async Task LogAsync(string action, string entityType, string entityId, string entityName, object? details = null)
    {
        try
        {
            var ctx = _http.HttpContext;
            var claims = ctx?.User;

            var userIdStr = claims?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            var username = claims?.FindFirst("unique_name")?.Value
                ?? claims?.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            var deptCode = claims?.FindFirst("dept")?.Value;
            var ip = ctx?.Connection?.RemoteIpAddress?.ToString();

            _db.AuditLogs.Add(new AuditLog
            {
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                EntityName = entityName,
                UserId = Guid.TryParse(userIdStr, out var uid) ? uid : (Guid?)null,
                Username = username,
                DepartmentCode = deptCode,
                Details = details != null ? JsonSerializer.Serialize(details) : null,
                IpAddress = ip,
            });
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit log: {Action} {EntityType} {EntityId}", action, entityType, entityId);
        }
    }
}
