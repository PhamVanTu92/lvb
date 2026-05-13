using LVB.Portal.Domain.Enums;

namespace LVB.Portal.Domain.Entities;

public class UploadSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = string.Empty;
    public string MinioObjectKey { get; set; } = string.Empty;  // path in MinIO bucket
    public long FileSizeBytes { get; set; }
    public string DepartmentCode { get; set; } = string.Empty;
    public Guid UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public UploadStatus Status { get; set; } = UploadStatus.Pending;
    public string? ErrorDetail { get; set; }           // JSON string for error details
    public int TotalSheets { get; set; }
    public int ProcessedSheets { get; set; }
    public int TotalRows { get; set; }
    public int ProcessedRows { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? HangfireJobId { get; set; }
    public Guid? SelectedMappingId { get; set; }  // Dataset người dùng chọn khi upload

    public Department? Department { get; set; }
    public User? Uploader { get; set; }
    public ICollection<UploadSheetResult> SheetResults { get; set; } = new List<UploadSheetResult>();
}
