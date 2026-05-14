namespace LVB.Portal.Domain.Entities;

/// <summary>
/// Visual Report Builder — persisted report configuration.
/// ConfigJson stores a serialized ReportConfig (tables, joins, select, filters, etc.)
/// </summary>
public class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }

    /// <summary>null or empty string means the report is visible to all departments.</summary>
    public string? DepartmentCode { get; set; }

    /// <summary>JSON-serialized ReportConfig.</summary>
    public string ConfigJson { get; set; } = "{}";

    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public int OrderIndex { get; set; } = 0;
}
