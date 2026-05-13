namespace LVB.Portal.Application.DTOs;

public record DataTableQueryRequest(
    string DepartmentCode,
    string TableName,
    int Page = 1,
    int PageSize = 50,
    string? Search = null,
    Guid? SessionId = null,
    string? ColumnFiltersJson = null
);

public record DataTableResult(
    string TableName,
    string DepartmentCode,
    IEnumerable<string> Columns,
    IEnumerable<Dictionary<string, object?>> Rows,
    int TotalRows,
    int Page,
    int PageSize,
    DateTime? LastUpdated
);

public record TableVersionDto(
    Guid SessionId,
    DateTime UploadedAt,
    string UploaderName,
    int TotalRows,
    string Status
);
