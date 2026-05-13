namespace LVB.Portal.Domain.Entities;

/// <summary>
/// Maps Excel sheet names to database table names per department
/// </summary>
public class SheetTableMapping
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SheetName { get; set; } = string.Empty;       // e.g. "Huy động/Cho vay"
    public string TableName { get; set; } = string.Empty;       // e.g. "huy_dong_cho_vay"
    public string DepartmentCode { get; set; } = string.Empty;  // null = apply to all departments
    public string ColumnMappingJson { get; set; } = "{}";       // {"NGAY_SO_LIEU":"ngay_so_lieu",...}
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<DatasetField> Fields { get; set; } = new List<DatasetField>();
}
