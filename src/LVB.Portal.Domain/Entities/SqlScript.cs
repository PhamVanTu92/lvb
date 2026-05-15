namespace LVB.Portal.Domain.Entities;

/// <summary>
/// An admin-only SQL script that can execute arbitrary PostgreSQL SQL
/// (INSERT, UPDATE, DELETE, WITH ... INSERT, etc.) with named parameters.
/// Unlike Reports (SELECT-only), scripts are intended for data processing jobs
/// such as computing KPI results, refreshing derived tables, etc.
/// </summary>
public class SqlScript
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }

    /// <summary>
    /// The PostgreSQL SQL to execute. May be multi-statement (DML + DQL).
    /// Use :param_name placeholders for dynamic values.
    /// </summary>
    public string ScriptSql { get; set; } = "";

    /// <summary>JSON array of ScriptParamDto — declares the expected parameters.</summary>
    public string ParamsJson { get; set; } = "[]";

    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public int OrderIndex { get; set; } = 0;
}
