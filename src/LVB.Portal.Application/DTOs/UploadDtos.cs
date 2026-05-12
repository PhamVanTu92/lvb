namespace LVB.Portal.Application.DTOs;

public record UploadSessionDto(
    Guid Id,
    string FileName,
    long FileSizeBytes,
    string DepartmentCode,
    string UploaderName,
    DateTime UploadedAt,
    string Status,
    int TotalSheets,
    int ProcessedSheets,
    int TotalRows,
    string? ErrorDetail,
    DateTime? CompletedAt,
    IEnumerable<SheetResultDto> SheetResults
);

public record SheetResultDto(
    string SheetName,
    string? MappedTableName,
    string Status,
    int InsertedRows,
    string? ErrorDetail
);

public record UploadProgressDto(
    string SessionId,
    string Status,
    int Progress,
    string Message
);
