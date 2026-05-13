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

public record BatchListItemDto(
    Guid Id,
    string BatchName,
    string? DataMonth,
    string? Notes,
    string UploaderName,
    string UploaderUsername,
    int RowCount,
    DateTime UploadedAt,
    string Status,
    string FileName,
    string? MetadataJson
);

public record BatchListResult(
    IEnumerable<BatchListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record DatasetFieldDto(
    Guid Id,
    Guid MappingId,
    string FieldName,
    string DisplayName,
    string FieldType,
    string[]? DropdownOptions,
    bool IsRequired,
    int OrderIndex,
    bool IsActive
);
