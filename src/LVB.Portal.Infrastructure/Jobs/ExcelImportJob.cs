using System.Text.Json;
using ClosedXML.Excel;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Domain.Enums;
using LVB.Portal.Domain.Interfaces;
using LVB.Portal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace LVB.Portal.Infrastructure.Jobs;

// Hub interface cho DI - Hub thực được define trong API project
public interface IUploadHub
{
    Task UploadProgress(object data);
}

public class ExcelImportJob
{
    private readonly AppDbContext _db;
    private readonly IStorageService _storage;
    private readonly ILogger<ExcelImportJob> _logger;
    private readonly IHubContext<UploadHub, IUploadHub> _hubContext;

    public ExcelImportJob(
        AppDbContext db,
        IStorageService storage,
        ILogger<ExcelImportJob> logger,
        IHubContext<UploadHub, IUploadHub> hubContext)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
        _hubContext = hubContext;
    }

    public async Task ProcessAsync(Guid sessionId)
    {
        var session = await _db.UploadSessions
            .Include(s => s.SheetResults)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null)
        {
            _logger.LogWarning("Upload session not found: {SessionId}", sessionId);
            return;
        }

        try
        {
            session.Status = UploadStatus.Processing;
            await _db.SaveChangesAsync();
            await NotifyProgress(session.Id.ToString(), "processing", 0, "Đang xử lý file...");

            // Download from MinIO
            using var fileStream = await _storage.DownloadAsync(session.MinioObjectKey);

            // Load sheet mappings for this department
            var mappings = await _db.SheetTableMappings
                .Where(m => m.IsActive && (m.DepartmentCode == session.DepartmentCode || m.DepartmentCode == ""))
                .ToListAsync();

            using var workbook = new XLWorkbook(fileStream);
            var sheets = workbook.Worksheets.ToList();
            session.TotalSheets = sheets.Count;
            await _db.SaveChangesAsync();

            int processedSheets = 0;
            int totalRowsProcessed = 0;

            // Chỉ xử lý sheet đầu tiên
            var worksheet = sheets.FirstOrDefault();
            if (worksheet == null) return;

            session.TotalSheets = 1;
            await _db.SaveChangesAsync();

            {
                var sheetName = worksheet.Name.Trim();

                // Tìm mapping: tên sheet → tên bảng → header cột → mapping duy nhất của dept
                var mapping = mappings.FirstOrDefault(m =>
                        string.Equals(m.SheetName, sheetName, StringComparison.OrdinalIgnoreCase))
                    ?? mappings.FirstOrDefault(m =>
                        string.Equals(m.TableName, sheetName, StringComparison.OrdinalIgnoreCase))
                    ?? FindMappingByHeaders(worksheet, mappings)
                    ?? (mappings.Count == 1 ? mappings[0] : null);

                var sheetResult = new UploadSheetResult
                {
                    UploadSessionId = sessionId,
                    SheetName = sheetName,
                    MappedTableName = mapping?.TableName,
                    Status = UploadStatus.Processing
                };
                _db.UploadSheetResults.Add(sheetResult);
                await _db.SaveChangesAsync();

                if (mapping == null)
                {
                    sheetResult.Status = UploadStatus.Failed;
                    sheetResult.ErrorDetail = "Không tìm thấy dataset phù hợp. Vui lòng khai báo dataset cho phòng ban này.";
                    await _db.SaveChangesAsync();
                }
                else
                {
                    try
                    {
                        var columnMapping = JsonSerializer.Deserialize<Dictionary<string, string>>(mapping.ColumnMappingJson)
                            ?? new Dictionary<string, string>();

                        var rowsInserted = await ImportSheetAsync(
                            worksheet, mapping.TableName, session.DepartmentCode, columnMapping, sessionId);

                        sheetResult.Status = UploadStatus.Success;
                        sheetResult.InsertedRows = rowsInserted;
                        sheetResult.TotalRows = rowsInserted;
                        totalRowsProcessed += rowsInserted;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing sheet {SheetName}", sheetName);
                        sheetResult.Status = UploadStatus.Failed;
                        sheetResult.ErrorDetail = ex.Message;
                    }
                }

                session.ProcessedSheets = 1;
                session.ProcessedRows = totalRowsProcessed;
                await _db.SaveChangesAsync();
                await NotifyProgress(sessionId.ToString(), "processing", 100, "Đang hoàn tất...");
            }

            session.Status = UploadStatus.Success;
            session.TotalRows = totalRowsProcessed;
            session.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await NotifyProgress(sessionId.ToString(), "success", 100, "Hoàn thành!");

            _logger.LogInformation("Import completed for session {SessionId}. Rows: {Rows}", sessionId, totalRowsProcessed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fatal error processing session {SessionId}", sessionId);
            session.Status = UploadStatus.Failed;
            session.ErrorDetail = ex.Message;
            session.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await NotifyProgress(sessionId.ToString(), "failed", 0, $"Lỗi: {ex.Message}");
        }
    }

    private async Task<int> ImportSheetAsync(
        IXLWorksheet worksheet,
        string tableName,
        string deptCode,
        Dictionary<string, string> columnMapping,
        Guid sessionId)
    {
        // Find header row (first non-empty row)
        var headerRow = worksheet.RowsUsed().FirstOrDefault();
        if (headerRow == null) return 0;

        // Build header → column index map
        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in headerRow.CellsUsed())
        {
            var headerText = cell.GetString().Trim();
            if (!string.IsNullOrEmpty(headerText))
                headerMap[headerText] = cell.Address.ColumnNumber;
        }

        var dataRows = worksheet.RowsUsed().Skip(1).ToList();
        if (dataRows.Count == 0) return 0;

        // Build INSERT SQL dynamically
        var dbColumns = columnMapping.Values.ToList();
        dbColumns.AddRange(["dept_code", "upload_session_id", "created_at"]);

        var columnList = string.Join(", ", dbColumns);
        var values = new List<string>();

        foreach (var row in dataRows)
        {
            var rowValues = new List<string>();
            foreach (var (excelHeader, dbColumn) in columnMapping)
            {
                if (headerMap.TryGetValue(excelHeader, out var colIdx))
                {
                    var cell = row.Cell(colIdx);
                    var val = GetCellValue(cell);
                    rowValues.Add(val);
                }
                else
                {
                    rowValues.Add("NULL");
                }
            }
            rowValues.Add($"'{deptCode.Replace("'", "''")}'");
            rowValues.Add($"'{sessionId}'");
            rowValues.Add($"'{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}'");
            values.Add($"({string.Join(", ", rowValues)})");
        }

        if (values.Count == 0) return 0;

        // Ensure table exists
        await EnsureTableExistsAsync(tableName, columnMapping.Values);

        // Batch insert (chunks of 500)
        int inserted = 0;
        const int chunkSize = 500;
        for (int i = 0; i < values.Count; i += chunkSize)
        {
            var chunk = values.Skip(i).Take(chunkSize);
            var sql = $"INSERT INTO {tableName} ({columnList}) VALUES {string.Join(", ", chunk)}";
            inserted += await _db.Database.ExecuteSqlRawAsync(sql);
        }

        return inserted;
    }

    private async Task EnsureTableExistsAsync(string tableName, IEnumerable<string> columns)
    {
        var colDefs = string.Join(",\n    ", columns.Select(c => $"{c} TEXT"));
        var sql = $"""
            CREATE TABLE IF NOT EXISTS {tableName} (
                id BIGSERIAL PRIMARY KEY,
                {colDefs},
                dept_code VARCHAR(50),
                upload_session_id UUID,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """;
        await _db.Database.ExecuteSqlRawAsync(sql);
    }

    private static string GetCellValue(IXLCell cell)
    {
        if (cell.IsEmpty()) return "NULL";
        return cell.DataType switch
        {
            XLDataType.Number => cell.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
            XLDataType.DateTime => $"'{cell.GetDateTime():yyyy-MM-dd HH:mm:ss}'",
            XLDataType.Boolean => cell.GetBoolean() ? "true" : "false",
            _ => $"'{cell.GetString().Replace("'", "''")}'",
        };
    }

    private static SheetTableMapping? FindMappingByHeaders(IXLWorksheet ws, List<SheetTableMapping> mappings)
    {
        var headerRow = ws.RowsUsed().FirstOrDefault();
        if (headerRow == null) return null;

        var excelHeaders = headerRow.CellsUsed()
            .Select(c => c.GetString().Trim())
            .Where(h => !string.IsNullOrEmpty(h))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return mappings
            .Select(m =>
            {
                Dictionary<string, string>? dict = null;
                try { dict = JsonSerializer.Deserialize<Dictionary<string, string>>(m.ColumnMappingJson); } catch { }
                var keys = dict?.Keys ?? [];
                var vals = dict?.Values ?? [];
                var hits = keys.Count(k => excelHeaders.Contains(k))
                         + vals.Count(v => excelHeaders.Contains(v));
                return (m, hits, total: Math.Max(1, dict?.Count ?? 1));
            })
            .Where(x => x.hits > 0 && x.hits >= Math.Max(1, x.total / 2))
            .OrderByDescending(x => x.hits)
            .Select(x => x.m)
            .FirstOrDefault();
    }

    private async Task NotifyProgress(string sessionId, string status, int progress, string message)
    {
        await _hubContext.Clients.Group($"upload_{sessionId}").UploadProgress(new
        {
            sessionId,
            status,
            progress,
            message
        });
    }
}

// Placeholder Hub class so Infrastructure can reference it in IHubContext<UploadHub, IUploadHub>
// The real implementation is in LVB.Portal.API.Hubs
public class UploadHub : Hub<IUploadHub>
{
    public async Task JoinSession(string sessionId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"upload_{sessionId}");
}
