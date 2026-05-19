using LVB.Portal.Application.DTOs;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Domain.Enums;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.API.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "SystemAdmin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PasswordService _passwordService;
    private readonly ILogger<AdminController> _logger;
    private readonly LVB.Portal.Infrastructure.Services.AuditService _audit;

    public AdminController(AppDbContext db, PasswordService passwordService,
        ILogger<AdminController> logger,
        LVB.Portal.Infrastructure.Services.AuditService audit)
    {
        _db = db;
        _passwordService = passwordService;
        _logger = logger;
        _audit = audit;
    }

    /// <summary>Danh sách tất cả users</summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var total = await _db.Users.CountAsync();
        var users = await _db.Users
            .Include(u => u.Department)
            .OrderBy(u => u.Username)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(u => new UserDto(u.Id, u.Username, u.FullName, u.Email,
                u.Role.ToString(), u.DepartmentCode,
                u.Department != null ? u.Department.Name : "",
                u.IsActive, u.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResult<UserDto>(users, total, page, pageSize));
    }

    /// <summary>Tạo user mới</summary>
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại" });

        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return Conflict(new { message = "Email đã được sử dụng" });

        var dept = await _db.Departments.FindAsync(request.DepartmentCode);
        if (dept == null)
            return BadRequest(new { message = "Phòng ban không tồn tại" });

        var user = new User
        {
            Username = request.Username,
            FullName = request.FullName,
            Email = request.Email,
            PasswordHash = _passwordService.HashPassword(request.Password),
            Role = request.Role,
            DepartmentCode = request.DepartmentCode
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("USER_CREATED", "User", user.Id.ToString(), user.Username,
            new { user.Role, user.DepartmentCode });

        return CreatedAtAction(nameof(GetUser), new { id = user.Id },
            new UserDto(user.Id, user.Username, user.FullName, user.Email,
                user.Role.ToString(), user.DepartmentCode, dept.Name, user.IsActive, user.CreatedAt));
    }

    /// <summary>Chi tiết user</summary>
    [HttpGet("users/{id:guid}")]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await _db.Users.Include(u => u.Department).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();
        return Ok(new UserDto(user.Id, user.Username, user.FullName, user.Email,
            user.Role.ToString(), user.DepartmentCode,
            user.Department?.Name ?? "", user.IsActive, user.CreatedAt));
    }

    /// <summary>Cập nhật user</summary>
    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (request.FullName != null) user.FullName = request.FullName;
        if (request.Email != null) user.Email = request.Email;
        if (request.Role.HasValue) user.Role = request.Role.Value;
        if (request.DepartmentCode != null) user.DepartmentCode = request.DepartmentCode;
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("USER_UPDATED", "User", id.ToString(), user.Username,
            new { request.FullName, request.Email, Role = request.Role?.ToString(), request.IsActive });
        return NoContent();
    }

    /// <summary>Reset mật khẩu</summary>
    [HttpPost("users/{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.PasswordHash = _passwordService.HashPassword(request.NewPassword);
        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("PASSWORD_RESET", "User", id.ToString(), user.Username);
        return Ok(new { message = "Đặt lại mật khẩu thành công" });
    }

    /// <summary>Danh sách phòng ban</summary>
    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments() =>
        Ok(await _db.Departments.OrderBy(d => d.Code).ToListAsync());

    /// <summary>Tạo phòng ban mới</summary>
    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] Department dept)
    {
        if (await _db.Departments.AnyAsync(d => d.Code == dept.Code))
            return Conflict(new { message = "Mã phòng ban đã tồn tại" });
        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetDepartments), dept);
    }

    // ─── Upload History (admin view + delete) ──────────────────────────

    /// <summary>Toàn bộ lịch sử upload (admin)</summary>
    [HttpGet("uploads")]
    public async Task<IActionResult> GetUploads(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? dept = null)
    {
        var query = _db.UploadSessions
            .Include(s => s.SheetResults)
            .Include(s => s.Uploader)
            .AsQueryable();

        if (!string.IsNullOrEmpty(dept))
            query = query.Where(s => s.DepartmentCode == dept);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(s => s.UploadedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        var dtos = items.Select(s => new
        {
            s.Id, s.FileName, s.FileSizeBytes, s.DepartmentCode,
            UploaderName = s.Uploader?.FullName ?? "",
            s.UploadedAt, Status = s.Status.ToString(),
            s.TotalSheets, s.ProcessedSheets, s.TotalRows, s.ErrorDetail, s.CompletedAt,
            SheetResults = s.SheetResults.Select(r => new
            {
                r.SheetName, r.MappedTableName, Status = r.Status.ToString(),
                r.InsertedRows, r.ErrorDetail
            })
        });

        return Ok(new { Items = dtos, TotalCount = total, Page = page, PageSize = pageSize });
    }

    /// <summary>Xóa upload session và toàn bộ dữ liệu đã import</summary>
    [HttpDelete("uploads/{id:guid}")]
    public async Task<IActionResult> DeleteUpload(Guid id)
    {
        var session = await _db.UploadSessions
            .Include(s => s.SheetResults)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session == null) return NotFound();

        // Xóa dữ liệu đã import từ các bảng động
        foreach (var sr in session.SheetResults.Where(r => r.MappedTableName != null))
        {
            try
            {
                var tableExists = await _db.Database.ExecuteSqlRawAsync(
                    $"SELECT 1 FROM information_schema.tables WHERE table_name = '{sr.MappedTableName!.Replace("'","''")}' LIMIT 1");
                await _db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM {sr.MappedTableName} WHERE upload_session_id = '{id}'");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete rows from {Table} for session {Id}", sr.MappedTableName, id);
            }
        }

        _db.UploadSessions.Remove(session);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Sheet-Table Mappings (Dataset registry) ───────────────────────

    /// <summary>Danh sách dataset mappings</summary>
    [HttpGet("sheet-mappings")]
    public async Task<IActionResult> GetSheetMappings() =>
        Ok(await _db.SheetTableMappings.OrderBy(m => m.SheetName).ToListAsync());

    /// <summary>Tạo dataset mapping mới</summary>
    [HttpPost("sheet-mappings")]
    public async Task<IActionResult> CreateSheetMapping([FromBody] SheetMappingRequest request)
    {
        if (await _db.SheetTableMappings.AnyAsync(m => m.TableName == request.TableName && m.DepartmentCode == request.DepartmentCode))
            return Conflict(new { message = "Tên bảng đã được đăng ký cho phòng ban này" });

        if (!string.IsNullOrEmpty(request.DepartmentCode))
        {
            var dept = await _db.Departments.FindAsync(request.DepartmentCode);
            if (dept == null) return BadRequest(new { message = "Phòng ban không tồn tại" });
        }

        var mapping = new LVB.Portal.Domain.Entities.SheetTableMapping
        {
            SheetName = request.SheetName,
            TableName = request.TableName.ToLowerInvariant().Replace(' ', '_'),
            DepartmentCode = request.DepartmentCode,
            ColumnMappingJson = request.ColumnMappingJson ?? "{}",
            IsActive = true
        };
        _db.SheetTableMappings.Add(mapping);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DATASET_CREATED", "Dataset", mapping.Id.ToString(), mapping.SheetName,
            new { mapping.TableName, mapping.DepartmentCode });
        return Ok(mapping);
    }

    /// <summary>Cập nhật dataset mapping</summary>
    [HttpPut("sheet-mappings/{id:guid}")]
    public async Task<IActionResult> UpdateSheetMapping(Guid id, [FromBody] SheetMappingRequest request)
    {
        var mapping = await _db.SheetTableMappings.FindAsync(id);
        if (mapping == null) return NotFound();

        mapping.SheetName = request.SheetName;
        mapping.ColumnMappingJson = request.ColumnMappingJson ?? mapping.ColumnMappingJson;
        mapping.IsActive = request.IsActive ?? mapping.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DATASET_UPDATED", "Dataset", id.ToString(), mapping.SheetName,
            new { mapping.IsActive });
        return Ok(mapping);
    }

    /// <summary>Xóa dataset mapping</summary>
    [HttpDelete("sheet-mappings/{id:guid}")]
    public async Task<IActionResult> DeleteSheetMapping(Guid id)
    {
        var mapping = await _db.SheetTableMappings.FindAsync(id);
        if (mapping == null) return NotFound();
        await _audit.LogAsync("DATASET_DELETED", "Dataset", id.ToString(), mapping.SheetName);
        _db.SheetTableMappings.Remove(mapping);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Tạo API key cho iTitan</summary>
    [HttpPost("api-keys")]
    public async Task<IActionResult> CreateApiKey([FromBody] CreateApiKeyRequest request)
    {
        // Generate raw key (returned once, never stored)
        var rawKey = $"lvb_{Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))}";
        var keyHash = _passwordService.HashPassword(rawKey);

        var apiKey = new ApiKey
        {
            Name = request.Name,
            Description = request.Description,
            KeyHash = keyHash,
            ExpiresAt = request.ExpiresAt
        };

        _db.ApiKeys.Add(apiKey);
        await _db.SaveChangesAsync();

        return Ok(new { apiKey.Id, apiKey.Name, RawKey = rawKey, Warning = "Lưu key này ngay, không thể xem lại!" });
    }

    /// <summary>Danh sách API keys</summary>
    [HttpGet("api-keys")]
    public async Task<IActionResult> GetApiKeys() =>
        Ok(await _db.ApiKeys.Select(k => new
        {
            k.Id, k.Name, k.Description, k.IsActive, k.CreatedAt, k.ExpiresAt, k.LastUsedAt
        }).ToListAsync());

    /// <summary>Vô hiệu hóa API key</summary>
    [HttpPatch("api-keys/{id:guid}/revoke")]
    public async Task<IActionResult> RevokeApiKey(Guid id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key is null) return NotFound();
        key.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "API key đã bị vô hiệu hóa." });
    }

    /// <summary>Kích hoạt lại API key</summary>
    [HttpPatch("api-keys/{id:guid}/activate")]
    public async Task<IActionResult> ActivateApiKey(Guid id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key is null) return NotFound();
        key.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "API key đã được kích hoạt." });
    }

    /// <summary>Xóa vĩnh viễn API key</summary>
    [HttpDelete("api-keys/{id:guid}")]
    public async Task<IActionResult> DeleteApiKey(Guid id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key is null) return NotFound();
        _db.ApiKeys.Remove(key);
        await _db.SaveChangesAsync();
        return Ok(new { message = "API key đã bị xóa vĩnh viễn." });
    }

    /// <summary>Danh sách fields của một dataset</summary>
    [HttpGet("dataset-fields/{mappingId:guid}")]
    public async Task<IActionResult> GetDatasetFields(Guid mappingId)
    {
        var raw = await _db.DatasetFields
            .Where(f => f.MappingId == mappingId && f.IsActive)
            .OrderBy(f => f.OrderIndex)
            .ToListAsync();

        var fields = raw.Select(f => new DatasetFieldDto(
            f.Id, f.MappingId, f.FieldName, f.DisplayName, f.FieldType,
            f.DropdownOptionsJson != null
                ? System.Text.Json.JsonSerializer.Deserialize<string[]>(f.DropdownOptionsJson)
                : null,
            f.IsRequired, f.OrderIndex, f.IsActive));

        return Ok(fields);
    }

    /// <summary>Tạo field mới cho dataset</summary>
    [HttpPost("dataset-fields")]
    public async Task<IActionResult> CreateDatasetField([FromBody] CreateDatasetFieldRequest req)
    {
        var mapping = await _db.SheetTableMappings.FindAsync(req.MappingId);
        if (mapping == null) return NotFound(new { message = "Dataset không tồn tại" });

        var maxOrder = await _db.DatasetFields
            .Where(f => f.MappingId == req.MappingId)
            .MaxAsync(f => (int?)f.OrderIndex) ?? -1;

        var field = new DatasetField
        {
            MappingId = req.MappingId,
            FieldName = req.FieldName,
            DisplayName = req.DisplayName,
            FieldType = req.FieldType,
            DropdownOptionsJson = req.DropdownOptions != null && req.DropdownOptions.Length > 0
                ? System.Text.Json.JsonSerializer.Serialize(req.DropdownOptions)
                : null,
            IsRequired = req.IsRequired,
            OrderIndex = maxOrder + 1
        };
        _db.DatasetFields.Add(field);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("FIELD_CREATED", "DatasetField", field.Id.ToString(), field.DisplayName,
            new { field.FieldName, field.FieldType, field.IsRequired, MappingId = req.MappingId });
        return Ok(new DatasetFieldDto(field.Id, field.MappingId, field.FieldName, field.DisplayName,
            field.FieldType, req.DropdownOptions, field.IsRequired, field.OrderIndex, field.IsActive));
    }

    /// <summary>Cập nhật field</summary>
    [HttpPut("dataset-fields/{id:guid}")]
    public async Task<IActionResult> UpdateDatasetField(Guid id, [FromBody] CreateDatasetFieldRequest req)
    {
        var field = await _db.DatasetFields.FindAsync(id);
        if (field == null) return NotFound();
        field.FieldName = req.FieldName;
        field.DisplayName = req.DisplayName;
        field.FieldType = req.FieldType;
        field.DropdownOptionsJson = req.DropdownOptions != null && req.DropdownOptions.Length > 0
            ? System.Text.Json.JsonSerializer.Serialize(req.DropdownOptions)
            : null;
        field.IsRequired = req.IsRequired;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("FIELD_UPDATED", "DatasetField", id.ToString(), field.DisplayName,
            new { field.FieldName, field.FieldType, field.IsRequired });
        return Ok();
    }

    /// <summary>Xóa field</summary>
    [HttpDelete("dataset-fields/{id:guid}")]
    public async Task<IActionResult> DeleteDatasetField(Guid id)
    {
        var field = await _db.DatasetFields.FindAsync(id);
        if (field == null) return NotFound();
        await _audit.LogAsync("FIELD_DELETED", "DatasetField", id.ToString(), field.DisplayName);
        _db.DatasetFields.Remove(field);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Audit Logs ────────────────────────────────────────────────────────

    /// <summary>Nhật ký hoạt động hệ thống</summary>
    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] string? username = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? entityId = null)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))     query = query.Where(l => l.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(l => l.EntityType == entityType);
        if (!string.IsNullOrWhiteSpace(username))   query = query.Where(l => l.Username != null && l.Username.Contains(username));
        if (!string.IsNullOrWhiteSpace(entityId))   query = query.Where(l => l.EntityId == entityId);
        if (from.HasValue) query = query.Where(l => l.CreatedAt >= from.Value);
        if (to.HasValue)   query = query.Where(l => l.CreatedAt <= to.Value.AddDays(1));

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(l => new {
                l.Id, l.Action, l.EntityType, l.EntityId, l.EntityName,
                l.Username, l.DepartmentCode, l.Details, l.IpAddress, l.CreatedAt
            })
            .ToListAsync();

        return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
    }
}

public record ResetPasswordRequest([System.ComponentModel.DataAnnotations.Required,
    System.ComponentModel.DataAnnotations.MinLength(8)] string NewPassword);

public record CreateDatasetFieldRequest(
    Guid MappingId,
    string FieldName,
    string DisplayName,
    string FieldType,
    string[]? DropdownOptions,
    bool IsRequired
);

public record CreateApiKeyRequest(
    [System.ComponentModel.DataAnnotations.Required] string Name,
    string? Description,
    DateTime? ExpiresAt);

public record SheetMappingRequest(
    [System.ComponentModel.DataAnnotations.Required] string SheetName,
    [System.ComponentModel.DataAnnotations.Required] string TableName,
    [System.ComponentModel.DataAnnotations.Required] string DepartmentCode,
    string? ColumnMappingJson,
    bool? IsActive);
