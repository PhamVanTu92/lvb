using LVB.Portal.Application.DTOs;
using LVB.Portal.Domain.Entities;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.API.Controllers;

/// <summary>
/// Admin-only endpoints for managing and running SQL Scripts.
///
/// SQL Scripts are arbitrary PostgreSQL SQL blocks (DML/DQL) with
/// named :param_name placeholders — designed for data processing jobs
/// such as computing KPI results, refreshing derived tables, etc.
/// </summary>
[ApiController]
[Route("api/v1/admin/scripts")]
[Authorize(Roles = "SystemAdmin")]
public class ScriptController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ScriptService _svc;

    public ScriptController(AppDbContext db, ScriptService svc)
    {
        _db = db;
        _svc = svc;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    /// <summary>Returns all SQL scripts ordered by OrderIndex then Name.</summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var scripts = await _db.Set<SqlScript>()
            .Where(s => s.IsActive)
            .OrderBy(s => s.OrderIndex).ThenBy(s => s.Name)
            .Select(s => new SqlScriptListItemDto(
                s.Id, s.Name, s.Description,
                s.IsActive, s.OrderIndex, s.CreatedByName, s.UpdatedAt))
            .ToListAsync();

        return Ok(scripts);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    /// <summary>Returns full detail of a single SQL script including its SQL text.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var s = await _db.Set<SqlScript>().FindAsync(id);
        if (s is null) return NotFound();

        return Ok(new SqlScriptDetailDto(
            s.Id, s.Name, s.Description, s.ScriptSql, s.ParamsJson,
            s.IsActive, s.OrderIndex, s.CreatedByName, s.CreatedAt, s.UpdatedAt));
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /// <summary>Creates a new SQL script.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSqlScriptRequest req)
    {
        var userId   = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("fullName")?.Value
                    ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

        var script = new SqlScript
        {
            Id             = Guid.NewGuid(),
            Name           = req.Name.Trim(),
            Description    = req.Description?.Trim(),
            ScriptSql      = req.ScriptSql,
            ParamsJson     = req.ParamsJson,
            OrderIndex     = req.OrderIndex,
            CreatedBy      = userId is not null ? Guid.Parse(userId) : null,
            CreatedByName  = userName,
            CreatedAt      = DateTime.UtcNow,
            UpdatedAt      = DateTime.UtcNow,
        };

        _db.Set<SqlScript>().Add(script);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = script.Id },
            new SqlScriptDetailDto(
                script.Id, script.Name, script.Description, script.ScriptSql,
                script.ParamsJson, script.IsActive, script.OrderIndex,
                script.CreatedByName, script.CreatedAt, script.UpdatedAt));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /// <summary>Updates an existing SQL script.</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSqlScriptRequest req)
    {
        var script = await _db.Set<SqlScript>().FindAsync(id);
        if (script is null) return NotFound();

        if (req.Name        is not null) script.Name        = req.Name.Trim();
        if (req.Description is not null) script.Description = req.Description.Trim();
        if (req.ScriptSql   is not null) script.ScriptSql   = req.ScriptSql;
        if (req.ParamsJson  is not null) script.ParamsJson   = req.ParamsJson;
        if (req.IsActive    is not null) script.IsActive     = req.IsActive.Value;
        if (req.OrderIndex  is not null) script.OrderIndex   = req.OrderIndex.Value;

        script.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /// <summary>Soft-deletes a SQL script.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var script = await _db.Set<SqlScript>().FindAsync(id);
        if (script is null) return NotFound();

        script.IsActive  = false;
        script.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Run ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// Executes a saved SQL script with the supplied parameter values.
    ///
    /// The script is executed inside a transaction.  If any statement fails the
    /// entire transaction is rolled back and the error is returned in the result
    /// (Success = false).
    /// </summary>
    [HttpPost("{id:guid}/run")]
    public async Task<IActionResult> Run(Guid id, [FromBody] RunScriptRequest? req)
    {
        var script = await _db.Set<SqlScript>().FindAsync(id);
        if (script is null) return NotFound();

        var result = await _svc.RunAsync(script.ScriptSql, req?.Params);
        return Ok(result);
    }

    // ── Ad-hoc run (for editor preview before saving) ─────────────────────────

    /// <summary>
    /// Executes a supplied SQL text directly — useful for testing in the editor
    /// before saving.  Admin only.
    /// </summary>
    [HttpPost("run-adhoc")]
    public async Task<IActionResult> RunAdhoc([FromBody] AdhocRunRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScriptSql))
            return BadRequest("ScriptSql is required.");

        var result = await _svc.RunAsync(req.ScriptSql, req.Params);
        return Ok(result);
    }
}

/// <summary>Request body for ad-hoc script execution.</summary>
public record AdhocRunRequest(string ScriptSql, Dictionary<string, string>? Params = null);
