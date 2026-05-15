using System.Data;
using System.Data.Common;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace LVB.Portal.Infrastructure.Services;

/// <summary>
/// Builds and executes safe, parameterised SQL queries from a <see cref="ReportConfig"/>.
///
/// Security guarantees:
///   - All table/column identifiers are validated against ^[a-z][a-z0-9_]{0,99}$
///   - Table names are additionally validated against registered SheetTableMappings
///   - Filter values are always bound as NpgsqlParameters, never string-concatenated
///   - Operators are checked against a strict whitelist
///   - Aggregate functions are checked against a strict whitelist
///   - JOIN types are checked against a strict whitelist
/// </summary>
public class ReportService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ReportService> _logger;

    // Security whitelists
    private static readonly HashSet<string> AllowedOperators =
        new(StringComparer.OrdinalIgnoreCase) { "=", "!=", ">", "<", ">=", "<=", "LIKE", "ILIKE" };

    private static readonly HashSet<string> AllowedAggregates =
        new(StringComparer.OrdinalIgnoreCase) { "SUM", "AVG", "COUNT", "MIN", "MAX" };

    private static readonly HashSet<string> AllowedJoinTypes =
        new(StringComparer.OrdinalIgnoreCase) { "INNER", "LEFT", "RIGHT", "FULL" };

    private static readonly Regex IdentifierRegex =
        new(@"^[a-z][a-z0-9_]{0,99}$", RegexOptions.Compiled);

    // Matches :param_name placeholders in raw SQL (e.g. :from_date, :to_date)
    private static readonly Regex ParamPlaceholderRegex =
        new(@":([a-z][a-z0-9_]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ReportService(AppDbContext db, ILogger<ReportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Runs a report with the given user-supplied filter parameters and pagination.
    /// </summary>
    /// <param name="configJson">Stored ConfigJson from the Report entity.</param>
    /// <param name="queryParams">Raw query string parameters from the HTTP request.</param>
    /// <param name="page">1-based page number.</param>
    /// <param name="pageSize">Rows per page (clamped to [1, 1000]).</param>
    public async Task<ReportRunResult> RunReportAsync(
        string configJson,
        IQueryCollection queryParams,
        int page = 1,
        int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 1000);

        var config = DeserializeConfig(configJson);

        // Route: raw SQL mode bypasses the visual builder entirely
        if (!string.IsNullOrWhiteSpace(config.RawSql))
            return await RunRawSqlAsync(config, queryParams, page, pageSize);

        // Build the core query (everything except LIMIT / OFFSET)
        var (coreSql, parameters) = await BuildCoreSqlAsync(config, queryParams);

        // COUNT query
        var countSql = $"SELECT COUNT(*) FROM ({coreSql}) _cnt";

        // Paged data query
        var orderSql = BuildOrderBy(config.OrderBy, config.Tables);
        var dataSql = $"{coreSql}{orderSql} LIMIT {pageSize} OFFSET {(page - 1) * pageSize}";

        _logger.LogDebug("Report data SQL: {Sql}", dataSql);

        await using var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync();

        // Execute count
        long totalCount = 0;
        await using (var countCmd = conn.CreateCommand())
        {
            countCmd.CommandText = countSql;
            AddParameters(countCmd, parameters);
            var scalar = await countCmd.ExecuteScalarAsync();
            totalCount = scalar is not null ? Convert.ToInt64(scalar) : 0;
        }

        // Execute data
        var columns = new List<string>();
        var rows = new List<Dictionary<string, object?>>();

        await using (var dataCmd = conn.CreateCommand())
        {
            dataCmd.CommandText = dataSql;
            AddParameters(dataCmd, parameters);

            await using var reader = await dataCmd.ExecuteReaderAsync();
            for (int i = 0; i < reader.FieldCount; i++)
                columns.Add(reader.GetName(i));

            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>(reader.FieldCount);
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var val = reader.GetValue(i);
                    row[columns[i]] = val == DBNull.Value ? null : val;
                }
                rows.Add(row);
            }
        }

        return new ReportRunResult(columns, rows, totalCount, page, pageSize);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Raw SQL execution
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Executes a raw PostgreSQL query stored in config.RawSql.
    ///
    /// Parameter injection:
    ///   The SQL may contain :param_name placeholders.  For each unique placeholder
    ///   (in order of first appearance) a NpgsqlParameter named param_name is created
    ///   and its value is taken from the HTTP query string.  If the caller did not
    ///   supply a value for a placeholder, NULL is bound (so the SQL can handle it
    ///   with COALESCE / IS NULL checks).
    ///
    /// Pagination:
    ///   The original SQL is wrapped as
    ///     SELECT COUNT(*) FROM (...original...) _cnt
    ///     SELECT * FROM (...original...) _data LIMIT n OFFSET m
    /// </summary>
    private async Task<ReportRunResult> RunRawSqlAsync(
        ReportConfig config,
        IQueryCollection queryParams,
        int page,
        int pageSize)
    {
        var rawSql = config.RawSql!.Trim();

        // Collect distinct :param_name placeholders (preserve first-appearance order)
        var seenParams = new LinkedList<string>(); // ordered, unique
        var seenSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match m in ParamPlaceholderRegex.Matches(rawSql))
        {
            var pName = m.Groups[1].Value.ToLower();
            if (seenSet.Add(pName))
                seenParams.AddLast(pName);
        }

        // Build NpgsqlParameters — one per unique placeholder
        var parameters = seenParams.Select(pName =>
        {
            queryParams.TryGetValue(pName, out var sv);
            var value = string.IsNullOrWhiteSpace(sv)
                ? (object)DBNull.Value
                : sv.ToString()!;
            return new NpgsqlParameter(pName, value);
        }).ToList();

        // Npgsql understands both :name and @name; we leave the SQL as-is
        // (Npgsql resolves :param_name → NpgsqlParameter named "param_name")
        var countSql = $"SELECT COUNT(*) FROM ({rawSql}) _cnt";
        var dataSql  = $"SELECT * FROM ({rawSql}) _data LIMIT {pageSize} OFFSET {(page - 1) * pageSize}";

        _logger.LogDebug("Raw SQL report — count: {Sql}", countSql);
        _logger.LogDebug("Raw SQL report — data:  {Sql}", dataSql);

        await using var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync();

        // Count
        long totalCount = 0;
        await using (var countCmd = conn.CreateCommand())
        {
            countCmd.CommandText = countSql;
            AddParameters(countCmd, parameters);
            var scalar = await countCmd.ExecuteScalarAsync();
            totalCount = scalar is not null ? Convert.ToInt64(scalar) : 0;
        }

        // Data
        var columns = new List<string>();
        var rows    = new List<Dictionary<string, object?>>();

        await using (var dataCmd = conn.CreateCommand())
        {
            dataCmd.CommandText = dataSql;
            AddParameters(dataCmd, parameters);

            await using var reader = await dataCmd.ExecuteReaderAsync();
            for (int i = 0; i < reader.FieldCount; i++)
                columns.Add(reader.GetName(i));

            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>(reader.FieldCount);
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var val = reader.GetValue(i);
                    row[columns[i]] = val == DBNull.Value ? null : val;
                }
                rows.Add(row);
            }
        }

        return new ReportRunResult(columns, rows, totalCount, page, pageSize);
    }

    /// <summary>
    /// Returns the ordered list of column names for a registered table.
    /// The table name must already exist in SheetTableMappings.
    /// </summary>
    public async Task<List<string>> GetTableColumnsAsync(string tableName)
    {
        ValidateIdentifier(tableName);
        await EnsureTableRegisteredAsync(tableName);

        await using var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name   = @table
              AND table_schema = 'public'
            ORDER BY ordinal_position
            """;
        cmd.Parameters.AddWithValue("table", tableName);

        var result = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            result.Add(reader.GetString(0));

        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SQL builder
    // ──────────────────────────────────────────────────────────────────────────

    private async Task<(string Sql, List<NpgsqlParameter> Parameters)> BuildCoreSqlAsync(
        ReportConfig config,
        IQueryCollection queryParams)
    {
        // Tables/Select are guaranteed non-null here because DeserializeConfig validates,
        // and RunReportAsync routes rawSql configs to RunRawSqlAsync before reaching here.
        if (config.Tables == null || config.Tables.Count == 0)
            throw new InvalidOperationException("Visual builder report must have at least one table.");

        // Collect registered table names for validation
        var registeredTables = await _db.SheetTableMappings
            .Where(m => m.IsActive)
            .Select(m => m.TableName.ToLower())
            .ToListAsync();

        var registeredSet = new HashSet<string>(registeredTables, StringComparer.OrdinalIgnoreCase);

        // Validate all tables
        var aliasMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); // alias -> tableName
        foreach (var t in config.Tables)
        {
            ValidateIdentifier(t.Alias);
            ValidateIdentifier(t.TableName);
            if (!registeredSet.Contains(t.TableName))
                throw new InvalidOperationException($"Table '{t.TableName}' is not a registered dataset table.");
            aliasMap[t.Alias] = t.TableName;
        }

        var parameters = new List<NpgsqlParameter>();

        // SELECT
        var selectParts = new List<string>();
        if (config.Select is not { Count: > 0 })
        {
            selectParts.Add("*");
        }
        else
        {
            foreach (var s in config.Select)
            {
                var expr = BuildSelectExpression(s, aliasMap);
                // Quote DisplayName to use as alias (escape double-quotes inside)
                var safeLabel = s.DisplayName.Replace("\"", "\"\"");
                selectParts.Add($"{expr} AS \"{safeLabel}\"");
            }
        }

        // FROM + JOINs
        var primaryTable = config.Tables[0];
        var fromClause = new StringBuilder();
        fromClause.Append($"\"{primaryTable.TableName}\" AS \"{primaryTable.Alias}\"");

        if (config.Joins != null)
        {
            foreach (var join in config.Joins)
            {
                var joinType = ValidateFromWhitelist(join.Type, AllowedJoinTypes, "join type");
                var (leftAlias, leftCol) = ParseRef(join.Left, aliasMap);
                var (rightAlias, rightCol) = ParseRef(join.Right, aliasMap);
                fromClause.Append(
                    $"\n  {joinType} JOIN \"{aliasMap[rightAlias]}\" AS \"{rightAlias}\"" +
                    $" ON \"{leftAlias}\".\"{leftCol}\" = \"{rightAlias}\".\"{rightCol}\"");
            }
        }

        // WHERE
        var whereParts = new List<string>();
        if (config.Filters != null)
        {
            foreach (var f in config.Filters)
            {
                var (alias, col) = ParseRef(f.Ref, aliasMap);
                var op = ValidateFromWhitelist(f.Op, AllowedOperators, "operator");

                // Only add the filter if the caller supplied the param
                if (!queryParams.TryGetValue(f.ParamName, out var rawVal) || string.IsNullOrEmpty(rawVal))
                    continue;

                var paramName = $"p_{parameters.Count}";
                var pgParam = new NpgsqlParameter(paramName, rawVal.ToString());
                parameters.Add(pgParam);

                whereParts.Add($"\"{alias}\".\"{col}\" {op} @{paramName}");
            }
        }

        // GROUP BY
        var groupParts = new List<string>();
        if (config.GroupBy != null)
        {
            foreach (var gRef in config.GroupBy)
            {
                var (alias, col) = ParseRef(gRef, aliasMap);
                groupParts.Add($"\"{alias}\".\"{col}\"");
            }
        }

        // Build SQL
        var sb = new StringBuilder();
        sb.Append("SELECT ");
        sb.Append(string.Join(", ", selectParts));
        sb.Append("\nFROM ");
        sb.Append(fromClause);

        if (whereParts.Count > 0)
        {
            sb.Append("\nWHERE ");
            sb.Append(string.Join("\n  AND ", whereParts));
        }

        if (groupParts.Count > 0)
        {
            sb.Append("\nGROUP BY ");
            sb.Append(string.Join(", ", groupParts));
        }

        return (sb.ToString(), parameters);
    }

    private static string BuildOrderBy(List<ROrderBy>? orderBy, List<RTable>? tables)
    {
        if (orderBy == null || orderBy.Count == 0)
            return string.Empty;

        var aliasMap = (tables ?? []).ToDictionary(t => t.Alias, t => t.TableName, StringComparer.OrdinalIgnoreCase);
        var parts = new List<string>();

        foreach (var o in orderBy)
        {
            var (alias, col) = ParseRef(o.Ref, aliasMap);
            string expr;
            if (!string.IsNullOrWhiteSpace(o.Agg))
            {
                var agg = ValidateFromWhitelist(o.Agg, AllowedAggregates, "aggregate");
                expr = $"{agg}(\"{alias}\".\"{col}\")";
            }
            else
            {
                expr = $"\"{alias}\".\"{col}\"";
            }
            parts.Add($"{expr} {(o.Desc ? "DESC" : "ASC")}");
        }

        return parts.Count > 0 ? $"\nORDER BY {string.Join(", ", parts)}" : string.Empty;
    }

    private static string BuildSelectExpression(RSelect s, Dictionary<string, string> aliasMap)
    {
        bool isCountStar = s.Ref == "*" &&
                           !string.IsNullOrWhiteSpace(s.Agg) &&
                           string.Equals(s.Agg, "COUNT", StringComparison.OrdinalIgnoreCase);

        if (isCountStar)
            return "COUNT(*)";

        var (alias, col) = ParseRef(s.Ref, aliasMap);
        var colExpr = $"\"{alias}\".\"{col}\"";

        if (!string.IsNullOrWhiteSpace(s.Agg))
        {
            var agg = ValidateFromWhitelist(s.Agg, AllowedAggregates, "aggregate");
            return $"{agg}({colExpr})";
        }

        return colExpr;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private static ReportConfig DeserializeConfig(string configJson)
    {
        if (string.IsNullOrWhiteSpace(configJson) || configJson == "{}")
            throw new InvalidOperationException("Report has no valid configuration.");

        var cfg = JsonSerializer.Deserialize<ReportConfig>(configJson, JsonOpts)
            ?? throw new InvalidOperationException("Failed to deserialize report config.");

        // Either rawSql or at least one table must be present
        if (string.IsNullOrWhiteSpace(cfg.RawSql) &&
            (cfg.Tables == null || cfg.Tables.Count == 0))
            throw new InvalidOperationException(
                "Report config must have either RawSql or at least one table.");

        return cfg;
    }

    private static (string Alias, string Column) ParseRef(string refStr, Dictionary<string, string> aliasMap)
    {
        var parts = refStr.Split('.', 2);
        if (parts.Length != 2)
            throw new InvalidOperationException($"Invalid column reference '{refStr}'. Expected format: alias.column");

        var alias = parts[0].Trim().ToLower();
        var col = parts[1].Trim().ToLower();

        ValidateIdentifier(alias);
        ValidateIdentifier(col);

        if (!aliasMap.ContainsKey(alias))
            throw new InvalidOperationException($"Unknown table alias '{alias}' in reference '{refStr}'.");

        return (alias, col);
    }

    private static void ValidateIdentifier(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || !IdentifierRegex.IsMatch(name))
            throw new InvalidOperationException(
                $"Invalid identifier '{name}'. Only lowercase letters, digits, and underscores are allowed, and it must start with a letter.");
    }

    private static string ValidateFromWhitelist(string value, HashSet<string> whitelist, string kind)
    {
        var upper = value.Trim().ToUpper();
        if (!whitelist.Contains(upper))
            throw new InvalidOperationException($"Invalid {kind} '{value}'.");
        return upper;
    }

    private async Task EnsureTableRegisteredAsync(string tableName)
    {
        var exists = await _db.SheetTableMappings
            .AnyAsync(m => m.IsActive && m.TableName.ToLower() == tableName.ToLower());

        if (!exists)
            throw new InvalidOperationException($"Table '{tableName}' is not a registered dataset table.");
    }

    private static void AddParameters(DbCommand cmd, List<NpgsqlParameter> parameters)
    {
        foreach (var p in parameters)
        {
            var clone = new NpgsqlParameter(p.ParameterName, p.Value ?? DBNull.Value);
            cmd.Parameters.Add(clone);
        }
    }
}
