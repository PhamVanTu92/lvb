using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace LVB.Portal.Infrastructure.Services;

public class DataTableService
{
    private readonly AppDbContext _db;
    private readonly ILogger<DataTableService> _logger;

    public DataTableService(AppDbContext db, ILogger<DataTableService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IEnumerable<TableInfo>> GetAvailableTablesAsync(string deptCode)
    {
        var mappings = await _db.SheetTableMappings
            .Where(m => m.IsActive && (m.DepartmentCode == deptCode || m.DepartmentCode == ""))
            .Select(m => new { m.TableName, m.SheetName })
            .Distinct()
            .ToListAsync();

        // Filter to only tables that actually exist in the DB
        var existing = new List<TableInfo>();
        foreach (var m in mappings)
        {
            if (await TableExistsAsync(m.TableName))
                existing.Add(new TableInfo(m.TableName, m.SheetName));
        }
        return existing;
    }

    public record TableInfo(string TableName, string SheetName);

    public async Task<DataTableResult?> QueryTableAsync(DataTableQueryRequest request)
    {
        if (!await TableExistsAsync(request.TableName))
            return null;

        // Validate dept access
        var mapping = await _db.SheetTableMappings
            .FirstOrDefaultAsync(m => m.TableName == request.TableName && m.IsActive);
        if (mapping == null) return null;

        var countSql = BuildCountSql(request.TableName, request.DepartmentCode, request.SessionId, request.Search);
        var dataSql = BuildDataSql(request.TableName, request.DepartmentCode, request.SessionId, request.Search,
            request.Page, request.PageSize);

        var totalRows = await ExecuteCountAsync(countSql);
        var rows = await ExecuteQueryAsync(dataSql);
        var columns = rows.FirstOrDefault()?.Keys.Where(k => k != "id" && k != "upload_session_id") ?? [];

        var lastSession = await _db.UploadSessions
            .Where(s => s.DepartmentCode == request.DepartmentCode && s.Status == Domain.Enums.UploadStatus.Success)
            .OrderByDescending(s => s.CompletedAt)
            .FirstOrDefaultAsync();

        return new DataTableResult(
            request.TableName,
            request.DepartmentCode,
            columns,
            rows.Select(r => r.Where(kv => kv.Key != "id" && kv.Key != "upload_session_id")
                .ToDictionary(kv => kv.Key, kv => kv.Value)),
            totalRows,
            request.Page,
            request.PageSize,
            lastSession?.CompletedAt
        );
    }

    public async Task<IEnumerable<TableVersionDto>> GetVersionsAsync(string tableName, string deptCode)
    {
        var mapping = await _db.SheetTableMappings
            .FirstOrDefaultAsync(m => m.TableName == tableName && m.IsActive);
        if (mapping == null) return [];

        var sessions = await _db.UploadSessions
            .Include(s => s.Uploader)
            .Include(s => s.SheetResults)
            .Where(s => s.DepartmentCode == deptCode
                && s.Status == Domain.Enums.UploadStatus.Success
                && s.SheetResults.Any(r => r.MappedTableName == tableName))
            .OrderByDescending(s => s.UploadedAt)
            .Take(50)
            .ToListAsync();

        return sessions.Select(s => new TableVersionDto(
            s.Id, s.UploadedAt, s.Uploader?.FullName ?? "",
            s.SheetResults.FirstOrDefault(r => r.MappedTableName == tableName)?.InsertedRows ?? 0,
            s.Status.ToString()
        ));
    }

    private string BuildCountSql(string table, string dept, Guid? sessionId, string? search)
    {
        var where = $"WHERE dept_code = '{dept.Replace("'", "''")}' ";
        if (sessionId.HasValue)
            where += $"AND upload_session_id = '{sessionId}'";
        return $"SELECT COUNT(*) FROM {table} {where}";
    }

    private string BuildDataSql(string table, string dept, Guid? sessionId, string? search, int page, int pageSize)
    {
        var where = $"WHERE dept_code = '{dept.Replace("'", "''")}' ";
        if (sessionId.HasValue)
            where += $"AND upload_session_id = '{sessionId}'";
        var offset = (page - 1) * pageSize;
        return $"SELECT * FROM {table} {where} ORDER BY id LIMIT {pageSize} OFFSET {offset}";
    }

    private async Task<int> ExecuteCountAsync(string sql)
    {
        using var cmd = _db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = sql;
        if (cmd.Connection!.State != System.Data.ConnectionState.Open)
            await cmd.Connection.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(string sql)
    {
        var results = new List<Dictionary<string, object?>>();
        using var cmd = _db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = sql;
        if (cmd.Connection!.State != System.Data.ConnectionState.Open)
            await cmd.Connection.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            results.Add(row);
        }
        return results;
    }

    private async Task<bool> TableExistsAsync(string tableName)
    {
        var sql = $"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{tableName.Replace("'", "''")}')";
        using var cmd = _db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = sql;
        if (cmd.Connection!.State != System.Data.ConnectionState.Open)
            await cmd.Connection.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        return result is true;
    }
}
