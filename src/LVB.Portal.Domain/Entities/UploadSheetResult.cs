using LVB.Portal.Domain.Enums;

namespace LVB.Portal.Domain.Entities;

public class UploadSheetResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UploadSessionId { get; set; }
    public string SheetName { get; set; } = string.Empty;
    public string? MappedTableName { get; set; }
    public UploadStatus Status { get; set; } = UploadStatus.Pending;
    public int TotalRows { get; set; }
    public int InsertedRows { get; set; }
    public string? ErrorDetail { get; set; }

    public UploadSession? UploadSession { get; set; }
}
