namespace LVB.Portal.Application.DTOs;

// ──────────────────────────────────────────────────────────────────────────────
// Script param descriptor (stored as JSON array inside SqlScript.ParamsJson)
// ──────────────────────────────────────────────────────────────────────────────

/// <summary>Declares one dynamic parameter for a SQL script.</summary>
/// <param name="ParamName">Name matching :param_name placeholder in the SQL.</param>
/// <param name="DisplayName">Human-readable label shown in the run UI.</param>
/// <param name="ParamType">UI hint: text | date | month | year | number</param>
public record ScriptParam(string ParamName, string DisplayName, string ParamType = "text");

// ──────────────────────────────────────────────────────────────────────────────
// API DTOs
// ──────────────────────────────────────────────────────────────────────────────

public record SqlScriptListItemDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    int OrderIndex,
    string? CreatedByName,
    DateTime UpdatedAt
);

public record SqlScriptDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string ScriptSql,
    string ParamsJson,
    bool IsActive,
    int OrderIndex,
    string? CreatedByName,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateSqlScriptRequest(
    string Name,
    string? Description,
    string ScriptSql,
    string ParamsJson = "[]",
    int OrderIndex = 0
);

public record UpdateSqlScriptRequest(
    string? Name,
    string? Description,
    string? ScriptSql,
    string? ParamsJson,
    bool? IsActive,
    int? OrderIndex
);

/// <summary>Request body for POST /api/v1/admin/scripts/{id}/run.</summary>
public record RunScriptRequest(
    /// <summary>Parameter values keyed by paramName.</summary>
    Dictionary<string, string>? Params = null
);

/// <summary>Result returned after executing a SQL script.</summary>
public record ScriptRunResult(
    bool Success,
    long RowsAffected,
    string? Error,
    double DurationMs,
    /// <summary>Column names if the last statement returned a result set.</summary>
    List<string>? Columns,
    /// <summary>Row data if the last statement returned a result set.</summary>
    List<Dictionary<string, object?>>? Rows
);
