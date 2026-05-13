namespace LVB.Portal.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Action { get; set; } = "";        // BATCH_CREATED, BATCH_UPDATED, BATCH_DELETED, USER_CREATED, USER_UPDATED, USER_DELETED, PASSWORD_RESET, DATASET_CREATED, DATASET_UPDATED, DATASET_DELETED, FIELD_CREATED, FIELD_UPDATED, FIELD_DELETED
    public string EntityType { get; set; } = "";    // Batch, User, Dataset, DatasetField
    public string? EntityId { get; set; }
    public string? EntityName { get; set; }         // Human-readable name
    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string? DepartmentCode { get; set; }
    public string? Details { get; set; }            // JSON string
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
