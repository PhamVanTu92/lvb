using Hangfire;
using LVB.Portal.Application.DTOs;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Domain.Enums;
using LVB.Portal.Domain.Interfaces;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LVB.Portal.Infrastructure.Services;

public class UploadService
{
    private readonly AppDbContext _db;
    private readonly IStorageService _storage;
    private readonly IBackgroundJobClient _jobClient;
    private readonly IConfiguration _config;
    private readonly ILogger<UploadService> _logger;

    public UploadService(
        AppDbContext db,
        IStorageService storage,
        IBackgroundJobClient jobClient,
        IConfiguration config,
        ILogger<UploadService> logger)
    {
        _db = db;
        _storage = storage;
        _jobClient = jobClient;
        _config = config;
        _logger = logger;
    }

    public async Task<(UploadSessionDto? Result, string? Error)> InitiateUploadAsync(
        Stream fileStream, string fileName, long fileSize, Guid userId, string deptCode)
    {
        // Validate file size
        var maxMB = int.Parse(_config["Upload:MaxFileSizeMB"] ?? "50");
        if (fileSize > maxMB * 1024 * 1024)
            return (null, $"File quá lớn. Tối đa {maxMB}MB.");

        // Validate extension
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return (null, "Chỉ hỗ trợ định dạng .xlsx và .xls");

        // Build MinIO object key
        var objectKey = $"{deptCode}/{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid()}/{fileName}";

        // Upload to MinIO
        await _storage.UploadAsync(fileStream, objectKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Create upload session
        var session = new UploadSession
        {
            FileName = fileName,
            MinioObjectKey = objectKey,
            FileSizeBytes = fileSize,
            DepartmentCode = deptCode,
            UploadedBy = userId,
            Status = UploadStatus.Pending
        };

        _db.UploadSessions.Add(session);
        await _db.SaveChangesAsync();

        // Enqueue background job
        var jobId = _jobClient.Enqueue<ExcelImportJob>(job => job.ProcessAsync(session.Id));
        session.HangfireJobId = jobId;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Upload initiated. Session: {SessionId}, Job: {JobId}", session.Id, jobId);

        return (MapToDto(session, ""), null);
    }

    public async Task<UploadSessionDto?> GetSessionAsync(Guid sessionId, string deptCode, bool isAdmin)
    {
        var query = _db.UploadSessions
            .Include(s => s.SheetResults)
            .Include(s => s.Uploader)
            .AsQueryable();

        if (!isAdmin)
            query = query.Where(s => s.DepartmentCode == deptCode);

        var session = await query.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return null;

        return MapToDto(session, session.Uploader?.FullName ?? "");
    }

    public async Task<PagedResult<UploadSessionDto>> GetHistoryAsync(
        string deptCode, bool isAdmin, int page, int pageSize, Guid? userId = null)
    {
        var query = _db.UploadSessions
            .Include(s => s.SheetResults)
            .Include(s => s.Uploader)
            .AsQueryable();

        if (!isAdmin)
            query = query.Where(s => s.DepartmentCode == deptCode);

        if (userId.HasValue)
            query = query.Where(s => s.UploadedBy == userId.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(s => s.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<UploadSessionDto>(
            items.Select(s => MapToDto(s, s.Uploader?.FullName ?? "")),
            total, page, pageSize);
    }

    public async Task<Stream?> DownloadOriginalAsync(Guid sessionId, string deptCode, bool isAdmin)
    {
        var session = await _db.UploadSessions.FindAsync(sessionId);
        if (session == null) return null;
        if (!isAdmin && session.DepartmentCode != deptCode) return null;

        return await _storage.DownloadAsync(session.MinioObjectKey);
    }

    private static UploadSessionDto MapToDto(UploadSession s, string uploaderName) => new(
        s.Id, s.FileName, s.FileSizeBytes, s.DepartmentCode, uploaderName,
        s.UploadedAt, s.Status.ToString(), s.TotalSheets, s.ProcessedSheets,
        s.TotalRows, s.ErrorDetail, s.CompletedAt,
        s.SheetResults.Select(r => new SheetResultDto(
            r.SheetName, r.MappedTableName, r.Status.ToString(), r.InsertedRows, r.ErrorDetail))
    );
}
