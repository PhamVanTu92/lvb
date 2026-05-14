using LVB.Portal.Application.DTOs;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.API.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class ReportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ReportService _reportService;
    private readonly AuditService _audit;

    public ReportController(AppDbContext db, ReportService reportService, AuditService audit)
    {
        _db = db;
        _reportService = reportService;
        _audit = audit;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Read endpoints (accessible to all authenticated users, filtered by dept)
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// List reports accessible to the current user.
    /// Admins see all reports; others see reports scoped to their dept plus global reports.
    /// </summary>
    [HttpGet("reports")]
    public async Task<IActionResult> GetReports()
    {
        var isAdmin = User.IsInRole("SystemAdmin");
        var userDept = User.FindFirst("dept")?.Value ?? "";

        IQueryable<Report> query = _db.Reports.Where(r => r.IsActive);

        if (!isAdmin)
        {
            // Non-admin: see global reports (null/empty DepartmentCode) + own dept
            query = query.Where(r =>
                r.DepartmentCode == null ||
                r.DepartmentCode == "" ||
                r.DepartmentCode == userDept);
        }

        var items = await query
            .OrderBy(r => r.OrderIndex)
            .ThenBy(r => r.Name)
            .Select(r => new ReportListItemDto(
                r.Id,
                r.Name,
                r.Description,
                r.DepartmentCode,
                r.CreatedAt,
                r.UpdatedAt,
                r.IsActive,
                r.OrderIndex,
                r.CreatedByName))
            .ToListAsync();

        return Ok(items);
    }

    /// <summary>Get full report detail including ConfigJson.</summary>
    [HttpGet("reports/{id:guid}")]
    public async Task<IActionResult> GetReport(Guid id)
    {
        var report = await _db.Reports.FindAsync(id);
        if (report is null)
            return NotFound(new { message = $"Report '{id}' not found." });

        if (!CanAccessReport(report))
            return Forbid();

        return Ok(MapToDetail(report));
    }

    /// <summary>
    /// Run a report and return paginated rows.
    /// Accessible via JWT **or** X-Api-Key header — suitable for machine-to-machine integration.
    /// Pass filter values as query parameters matching the ParamName fields defined in the config.
    /// Example: GET /api/v1/reports/{id}/run?page=1&amp;pageSize=100&amp;month=04/2026
    /// </summary>
    [HttpGet("reports/{id:guid}/run")]
    [Authorize(Policy = "ApiKeyOrJwt")]
    public async Task<IActionResult> RunReport(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var report = await _db.Reports.FindAsync(id);
        if (report is null)
            return NotFound(new { message = $"Report '{id}' not found." });

        if (!CanAccessReport(report))
            return Forbid();

        try
        {
            var result = await _reportService.RunReportAsync(
                report.ConfigJson,
                Request.Query,
                page,
                pageSize);

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while running the report.", detail = ex.Message });
        }
    }

    /// <summary>
    /// Get columns of the primary (first) table in this report's config.
    /// Useful for the builder preview panel.
    /// </summary>
    [HttpGet("reports/{id:guid}/columns")]
    public async Task<IActionResult> GetReportColumns(Guid id)
    {
        var report = await _db.Reports.FindAsync(id);
        if (report is null)
            return NotFound(new { message = $"Report '{id}' not found." });

        if (!CanAccessReport(report))
            return Forbid();

        try
        {
            // Parse config to get primary table name
            var config = System.Text.Json.JsonSerializer.Deserialize<ReportConfig>(
                report.ConfigJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (config?.Tables == null || config.Tables.Count == 0)
                return BadRequest(new { message = "Report config has no tables defined." });

            var primaryTable = config.Tables[0].TableName;
            var columns = await _reportService.GetTableColumnsAsync(primaryTable);
            return Ok(new { TableName = primaryTable, Columns = columns });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin read endpoint
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>Get columns for any registered table. Used by the report builder UI.</summary>
    [HttpGet("admin/tables/{tableName}/columns")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTableColumns(string tableName)
    {
        try
        {
            var columns = await _reportService.GetTableColumnsAsync(tableName);
            return Ok(new { TableName = tableName, Columns = columns });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin write endpoints
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>Create a new report definition.</summary>
    [HttpPost("admin/reports")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        if (string.IsNullOrWhiteSpace(req.ConfigJson))
            return BadRequest(new { message = "ConfigJson is required." });

        // Basic JSON validation
        try { System.Text.Json.JsonDocument.Parse(req.ConfigJson); }
        catch { return BadRequest(new { message = "ConfigJson is not valid JSON." }); }

        var userIdStr = User.FindFirst("sub")?.Value;
        var userName = User.FindFirst("unique_name")?.Value
                    ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

        var report = new Report
        {
            Name = req.Name.Trim(),
            Description = req.Description?.Trim(),
            DepartmentCode = string.IsNullOrWhiteSpace(req.DepartmentCode) ? null : req.DepartmentCode.Trim(),
            ConfigJson = req.ConfigJson,
            OrderIndex = req.OrderIndex,
            CreatedBy = Guid.TryParse(userIdStr, out var uid) ? uid : null,
            CreatedByName = userName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Reports.Add(report);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("REPORT_CREATED", "Report", report.Id.ToString(), report.Name,
            new { report.DepartmentCode, report.OrderIndex });

        return CreatedAtAction(nameof(GetReport), new { id = report.Id }, MapToDetail(report));
    }

    /// <summary>Update an existing report definition (partial update — only supplied fields changed).</summary>
    [HttpPut("admin/reports/{id:guid}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdateReport(Guid id, [FromBody] UpdateReportRequest req)
    {
        var report = await _db.Reports.FindAsync(id);
        if (report is null)
            return NotFound(new { message = $"Report '{id}' not found." });

        if (req.Name != null)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "Name cannot be empty." });
            report.Name = req.Name.Trim();
        }

        if (req.Description != null)
            report.Description = req.Description.Trim();

        if (req.DepartmentCode != null)
            report.DepartmentCode = string.IsNullOrWhiteSpace(req.DepartmentCode) ? null : req.DepartmentCode.Trim();

        if (req.ConfigJson != null)
        {
            try { System.Text.Json.JsonDocument.Parse(req.ConfigJson); }
            catch { return BadRequest(new { message = "ConfigJson is not valid JSON." }); }
            report.ConfigJson = req.ConfigJson;
        }

        if (req.IsActive.HasValue)
            report.IsActive = req.IsActive.Value;

        if (req.OrderIndex.HasValue)
            report.OrderIndex = req.OrderIndex.Value;

        report.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync("REPORT_UPDATED", "Report", report.Id.ToString(), report.Name,
            new { req.Name, req.IsActive, req.OrderIndex });

        return Ok(MapToDetail(report));
    }

    /// <summary>Soft-delete a report (sets IsActive = false).</summary>
    [HttpDelete("admin/reports/{id:guid}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeleteReport(Guid id)
    {
        var report = await _db.Reports.FindAsync(id);
        if (report is null)
            return NotFound(new { message = $"Report '{id}' not found." });

        report.IsActive = false;
        report.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync("REPORT_DELETED", "Report", report.Id.ToString(), report.Name, null);

        return NoContent();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private bool CanAccessReport(Report report)
    {
        if (User.IsInRole("SystemAdmin"))
            return true;

        var userDept = User.FindFirst("dept")?.Value ?? "";

        // Global report (no dept restriction)
        if (string.IsNullOrEmpty(report.DepartmentCode))
            return true;

        return report.DepartmentCode == userDept;
    }

    private static ReportDetailDto MapToDetail(Report r) => new(
        r.Id,
        r.Name,
        r.Description,
        r.DepartmentCode,
        r.ConfigJson,
        r.CreatedAt,
        r.UpdatedAt,
        r.IsActive,
        r.OrderIndex,
        r.CreatedByName);
}
