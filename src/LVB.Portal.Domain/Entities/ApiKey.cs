namespace LVB.Portal.Domain.Entities;

/// <summary>
/// API keys for iTitan system integration
/// </summary>
public class ApiKey
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string KeyHash { get; set; } = string.Empty;   // BCrypt hashed key
    public string Name { get; set; } = string.Empty;      // e.g. "iTitan Production"
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}
