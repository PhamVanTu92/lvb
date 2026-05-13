namespace LVB.Portal.Domain.Entities;

public class DatasetField
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MappingId { get; set; }
    public SheetTableMapping Mapping { get; set; } = null!;
    public string FieldName { get; set; } = "";       // snake_case DB column name
    public string DisplayName { get; set; } = "";     // Vietnamese display name
    public string FieldType { get; set; } = "text";   // text|number|date|month|quarter|year|dropdown|textarea
    public string? DropdownOptionsJson { get; set; }  // JSON array e.g. ["Option1","Option2"]
    public bool IsRequired { get; set; }
    public int OrderIndex { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
