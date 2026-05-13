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

    public AdminController(AppDbContext db, PasswordService passwordService)
    {
        _db = db;
        _passwordService = passwordService;
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
        return Ok(mapping);
    }

    /// <summary>Xóa dataset mapping</summary>
    [HttpDelete("sheet-mappings/{id:guid}")]
    public async Task<IActionResult> DeleteSheetMapping(Guid id)
    {
        var mapping = await _db.SheetTableMappings.FindAsync(id);
        if (mapping == null) return NotFound();
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
}

public record ResetPasswordRequest([System.ComponentModel.DataAnnotations.Required,
    System.ComponentModel.DataAnnotations.MinLength(8)] string NewPassword);

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
