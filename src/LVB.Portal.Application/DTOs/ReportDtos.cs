namespace LVB.Portal.Application.DTOs;

// ──────────────────────────────────────────────────────────────────────────────
// Config model (serialized to / from ConfigJson stored in the reports table)
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Top-level report configuration stored as JSON inside Report.ConfigJson.
///
/// Two modes are supported:
///   • <b>Visual Builder</b>: Tables + Select are required; Joins/GroupBy/OrderBy optional.
///   • <b>Raw SQL</b>: RawSql is set; Tables/Select are ignored. Filter params are still
///     used for the UI input fields; their values are injected into SQL via :param_name.
///
/// All identifier strings in Visual mode are validated server-side before SQL use.
/// </summary>
public record ReportConfig(
    List<RTable>? Tables,
    List<RJoin>? Joins,
    List<RSelect>? Select,
    List<string>? GroupBy,
    List<RFilter>? Filters,
    List<ROrderBy>? OrderBy,
    RChart? Chart,
    /// <summary>
    /// Raw PostgreSQL SQL. When non-empty the visual builder fields are ignored.
    /// Use :param_name placeholders for dynamic values (e.g. WHERE date BETWEEN :from_date AND :to_date).
    /// The query is wrapped as SELECT * FROM (...) _data LIMIT ? OFFSET ? for pagination.
    /// </summary>
    string? RawSql = null
);

/// <summary>A table included in the FROM clause, identified by an alias.</summary>
/// <param name="Alias">Short alias used elsewhere in the config (e.g. "t1").</param>
/// <param name="TableName">Actual DB table name, validated against SheetTableMappings.</param>
public record RTable(string Alias, string TableName);

/// <summary>A JOIN clause between two tables.</summary>
/// <param name="Type">INNER | LEFT | RIGHT | FULL</param>
/// <param name="Left">Fully-qualified column reference: "alias.column"</param>
/// <param name="Right">Fully-qualified column reference: "alias.column"</param>
public record RJoin(string Type, string Left, string Right);

/// <summary>A column (or aggregate expression) in the SELECT list.</summary>
/// <param name="Ref">Column reference "alias.column". Use "*" with Agg="COUNT" for COUNT(*).</param>
/// <param name="Agg">Optional aggregate: SUM | AVG | COUNT | MIN | MAX</param>
/// <param name="DisplayName">Label returned in the column header.</param>
public record RSelect(string Ref, string? Agg, string DisplayName);

/// <summary>A parameterised WHERE clause filter.</summary>
/// <param name="Ref">Column reference "alias.column".</param>
/// <param name="Op">Comparison operator: = | != | &gt; | &lt; | &gt;= | &lt;= | LIKE | ILIKE</param>
/// <param name="ParamName">Name of the query-string parameter that supplies the value.</param>
/// <param name="DisplayName">Human-readable label shown in the filter UI.</param>
/// <param name="ParamType">Hint for the UI: text | number | date | month (default: text).</param>
public record RFilter(string Ref, string Op, string ParamName, string DisplayName, string ParamType = "text");

/// <summary>An ORDER BY term.</summary>
/// <param name="Ref">Column reference "alias.column".</param>
/// <param name="Agg">Optional aggregate applied before ordering.</param>
/// <param name="Desc">True for DESC, false (default) for ASC.</param>
public record ROrderBy(string Ref, string? Agg, bool Desc = false);

/// <summary>Optional chart metadata for the frontend renderer.</summary>
/// <param name="Type">Chart type hint, e.g. "bar" | "line" | "pie".</param>
/// <param name="XField">DisplayName of the column to use as the X axis.</param>
/// <param name="YFields">DisplayNames of columns to use as Y series.</param>
public record RChart(string Type, string XField, List<string> YFields);

// ──────────────────────────────────────────────────────────────────────────────
// API DTOs
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>Lightweight item returned by GET /api/v1/reports.</summary>
public record ReportListItemDto(
    Guid Id,
    string Name,
    string? Description,
    string? DepartmentCode,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsActive,
    int OrderIndex,
    string? CreatedByName
);

/// <summary>Full detail returned by GET /api/v1/reports/{id}.</summary>
public record ReportDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string? DepartmentCode,
    string ConfigJson,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsActive,
    int OrderIndex,
    string? CreatedByName
);

/// <summary>Result of GET /api/v1/reports/{id}/run.</summary>
public record ReportRunResult(
    List<string> Columns,
    List<Dictionary<string, object?>> Rows,
    long TotalCount,
    int Page,
    int PageSize
);

/// <summary>Request body for POST /api/v1/admin/reports.</summary>
public record CreateReportRequest(
    string Name,
    string? Description,
    string? DepartmentCode,
    string ConfigJson,
    int OrderIndex = 0
);

/// <summary>Request body for PUT /api/v1/admin/reports/{id}. All fields optional (PATCH semantics).</summary>
public record UpdateReportRequest(
    string? Name,
    string? Description,
    string? DepartmentCode,
    string? ConfigJson,
    bool? IsActive,
    int? OrderIndex
);
