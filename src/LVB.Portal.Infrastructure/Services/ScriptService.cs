using System.Data;
using System.Diagnostics;
using System.Text.RegularExpressions;
using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace LVB.Portal.Infrastructure.Services;

/// <summary>
/// Executes arbitrary PostgreSQL SQL scripts with named :param_name parameters.
///
/// Security notes:
///   • This service is intended for admin use ONLY.
///   • Scripts are executed inside a transaction — partial failures are rolled back.
///   • Parameter values are always bound via NpgsqlParameter, never concatenated.
///   • A command timeout of 300 seconds is enforced to prevent runaway queries.
/// </summary>
public class ScriptService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ScriptService> _logger;

    private static readonly Regex ParamPlaceholder =
        new(@":([a-z][a-z0-9_]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private const int CommandTimeoutSeconds = 300;

    public ScriptService(AppDbContext db, ILogger<ScriptService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Executes the given SQL script inside a transaction.
    ///
    /// The script may contain any number of statements separated by semicolons.
    /// :param_name placeholders are replaced with Npgsql named parameters whose
    /// values come from the <paramref name="paramValues"/> dictionary.
    ///
    /// If the last statement is a SELECT, its result set is returned in
    /// <see cref="ScriptRunResult.Columns"/> and <see cref="ScriptRunResult.Rows"/>.
    /// </summary>
    public async Task<ScriptRunResult> RunAsync(
        string scriptSql,
        Dictionary<string, string>? paramValues)
    {
        paramValues ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        // Collect distinct :param_name placeholders (first-appearance order)
        var seen = new LinkedList<string>();
        var seenSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match m in ParamPlaceholder.Matches(scriptSql))
        {
            var pName = m.Groups[1].Value.ToLower();
            if (seenSet.Add(pName))
                seen.AddLast(pName);
        }

        // Build NpgsqlParameters
        var parameters = seen.Select(pName =>
        {
            paramValues.TryGetValue(pName, out var val);
            var value = string.IsNullOrWhiteSpace(val)
                ? (object)DBNull.Value
                : val;
            return new NpgsqlParameter(pName, value);
        }).ToList();

        _logger.LogInformation("Executing SQL script ({ParamCount} params)", parameters.Count);
        _logger.LogDebug("Script SQL: {Sql}", scriptSql);

        await using var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync();

        await using var transaction = await conn.BeginTransactionAsync();
        var sw = Stopwatch.StartNew();

        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = (Npgsql.NpgsqlTransaction)transaction;
            cmd.CommandText = scriptSql;
            cmd.CommandTimeout = CommandTimeoutSeconds;

            foreach (var p in parameters)
                cmd.Parameters.Add(new NpgsqlParameter(p.ParameterName, p.Value ?? DBNull.Value));

            // Execute and collect results from all result sets
            await using var reader = await cmd.ExecuteReaderAsync();

            var lastColumns = new List<string>();
            var lastRows    = new List<Dictionary<string, object?>>();
            long totalAffected = 0;

            do
            {
                if (reader.FieldCount > 0)
                {
                    // This result set has columns → it is a SELECT
                    lastColumns.Clear();
                    lastRows.Clear();
                    for (int i = 0; i < reader.FieldCount; i++)
                        lastColumns.Add(reader.GetName(i));

                    while (await reader.ReadAsync())
                    {
                        var row = new Dictionary<string, object?>(reader.FieldCount);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var v = reader.GetValue(i);
                            row[lastColumns[i]] = v == DBNull.Value ? null : v;
                        }
                        lastRows.Add(row);
                    }
                }

                // RecordsAffected is -1 for SELECT, >= 0 for DML
                if (reader.RecordsAffected >= 0)
                    totalAffected += reader.RecordsAffected;
            }
            while (await reader.NextResultAsync());

            sw.Stop();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Script executed OK in {Ms:F0}ms, {Rows} rows affected",
                sw.Elapsed.TotalMilliseconds, totalAffected);

            return new ScriptRunResult(
                Success:      true,
                RowsAffected: totalAffected,
                Error:        null,
                DurationMs:   sw.Elapsed.TotalMilliseconds,
                Columns: lastColumns.Count > 0 ? lastColumns : null,
                Rows:    lastColumns.Count > 0 ? lastRows    : null
            );
        }
        catch (Exception ex)
        {
            sw.Stop();
            await transaction.RollbackAsync();

            _logger.LogWarning(ex, "Script execution failed after {Ms:F0}ms", sw.Elapsed.TotalMilliseconds);

            return new ScriptRunResult(
                Success:      false,
                RowsAffected: 0,
                Error:        ex.Message,
                DurationMs:   sw.Elapsed.TotalMilliseconds,
                Columns:      null,
                Rows:         null
            );
        }
    }
}
