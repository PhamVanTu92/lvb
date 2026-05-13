using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.API.Controllers;

[ApiController]
[Route("api/v1")]
public class DataController : ControllerBase
{
    private readonly DataTableService _dataService;

    public DataController(DataTableService dataService) => _dataService = dataService;

    /// <summary>Danh sách phòng ban và Data Table hiện có</summary>
    [HttpGet("departments")]
    [Authorize]
    public async Task<IActionResult> GetDepartments([FromServices] LVB.Portal.Infrastructure.Data.AppDbContext db)
    {
        var isAdmin = User.IsInRole("SystemAdmin");
        var userDeptCode = User.FindFirst("dept")?.Value ?? "";

        var allMappings = await db.SheetTableMappings
            .Where(m => m.IsActive)
            .ToListAsync();

        var result = new List<object>();

        if (isAdmin)
        {
            // Global datasets (DepartmentCode == "") → appear once under virtual "_all" dept
            var globalTables = allMappings
                .Where(m => m.DepartmentCode == "")
                .GroupBy(m => m.TableName)
                .Select(g => new { g.First().TableName, g.First().SheetName })
                .ToList();

            if (globalTables.Count > 0)
                result.Add(new { Code = "_all", Name = "Chung", Tables = globalTables });

            // Dept-specific datasets → under their respective dept
            var depts = await db.Departments
                .Where(d => d.IsActive)
                .Select(d => new { d.Code, d.Name })
                .ToListAsync();

            foreach (var dept in depts)
            {
                var tables = allMappings
                    .Where(m => m.DepartmentCode == dept.Code)
                    .GroupBy(m => m.TableName)
                    .Select(g => new { g.First().TableName, g.First().SheetName })
                    .ToList();

                if (tables.Count > 0)
                    result.Add(new { dept.Code, dept.Name, Tables = tables });
            }
        }
        else
        {
            // Non-admin: their own dept + global datasets combined, no duplicates
            var dept = await db.Departments
                .Where(d => d.IsActive && d.Code == userDeptCode)
                .Select(d => new { d.Code, d.Name })
                .FirstOrDefaultAsync();

            if (dept != null)
            {
                var tables = allMappings
                    .Where(m => m.DepartmentCode == userDeptCode || m.DepartmentCode == "")
                    .GroupBy(m => m.TableName)
                    .Select(g => new { g.First().TableName, g.First().SheetName })
                    .ToList();

                result.Add(new { dept.Code, dept.Name, Tables = tables });
            }
        }

        return Ok(result);
    }

    /// <summary>Lấy dữ liệu Data Table (có phân trang, filter)</summary>
    [HttpGet("data/{dept}/{table}")]
    [Authorize]
    public async Task<IActionResult> GetData(
        string dept, string table,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] Guid? sessionId = null,
        [FromQuery] string? columnFilters = null)
    {
        // "_all" = global dataset, admin only
        if (dept == "_all" && !IsAdmin()) return Forbid();

        // Kiểm tra quyền: user chỉ xem dept của mình, admin xem tất cả
        var userDept = User.FindFirst("dept")?.Value;
        if (!IsAdmin() && userDept != dept)
            return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);
        var result = await _dataService.QueryTableAsync(new DataTableQueryRequest(
            dept, table, page, pageSize, search, sessionId, columnFilters));

        if (result == null) return NotFound(new { message = $"Table '{table}' not found" });
        return Ok(result);
    }

    /// <summary>Lấy dữ liệu phiên bản mới nhất (dành cho iTitan)</summary>
    [HttpGet("data/{dept}/{table}/latest")]
    [Authorize(Policy = "ApiKeyOrJwt")]
    public async Task<IActionResult> GetLatest(string dept, string table)
    {
        var result = await _dataService.QueryTableAsync(new DataTableQueryRequest(dept, table, 1, 1000));
        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>Lịch sử các lần upload của Data Table</summary>
    [HttpGet("data/{dept}/{table}/versions")]
    [Authorize]
    public async Task<IActionResult> GetVersions(string dept, string table)
    {
        if (!IsAdmin() && User.FindFirst("dept")?.Value != dept)
            return Forbid();

        var versions = await _dataService.GetVersionsAsync(table, dept);
        return Ok(versions);
    }

    /// <summary>Danh sách dataset cho user hiện tại (dùng khi chọn dataset để upload)</summary>
    [HttpGet("datasets")]
    [Authorize]
    public async Task<IActionResult> GetDatasets([FromServices] LVB.Portal.Infrastructure.Data.AppDbContext db)
    {
        var isAdmin = User.IsInRole("SystemAdmin");
        var userDeptCode = User.FindFirst("dept")?.Value ?? "";

        var mappings = await db.SheetTableMappings
            .Where(m => m.IsActive && (
                isAdmin ||
                m.DepartmentCode == userDeptCode ||
                m.DepartmentCode == ""))
            .OrderBy(m => m.SheetName)
            .Select(m => new { m.Id, m.SheetName, m.TableName, m.DepartmentCode })
            .ToListAsync();

        return Ok(mappings);
    }

    /// <summary>Health check</summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health() => Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow,
        version = "1.0.0"
    });

    private bool IsAdmin() => User.IsInRole("SystemAdmin");
}
