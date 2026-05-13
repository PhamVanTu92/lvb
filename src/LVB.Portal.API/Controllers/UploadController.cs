using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LVB.Portal.API.Controllers;

[ApiController]
[Route("api/v1/upload")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly UploadService _uploadService;
    private readonly ILogger<UploadController> _logger;

    public UploadController(UploadService uploadService, ILogger<UploadController> logger)
    {
        _uploadService = uploadService;
        _logger = logger;
    }

    /// <summary>Upload file Excel mới</summary>
    [HttpPost]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100MB hard limit
    public async Task<IActionResult> Upload(
        IFormFile file,
        [FromForm] Guid? mappingId = null,
        [FromForm] string? batchName = null,
        [FromForm] string? dataMonth = null,
        [FromForm] string? notes = null)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file" });

        var userId = GetCurrentUserId();
        var deptCode = GetCurrentDeptCode();

        using var stream = file.OpenReadStream();
        var (result, error) = await _uploadService.InitiateUploadAsync(
            stream, file.FileName, file.Length, userId, deptCode, mappingId, batchName, dataMonth, notes);

        if (error != null) return BadRequest(new { message = error });
        return Accepted(result);
    }

    /// <summary>Lấy trạng thái xử lý của upload session</summary>
    [HttpGet("{sessionId:guid}/status")]
    public async Task<IActionResult> GetStatus(Guid sessionId)
    {
        var isAdmin = IsAdmin();
        var session = await _uploadService.GetSessionAsync(sessionId, GetCurrentDeptCode(), isAdmin);
        if (session == null) return NotFound();
        return Ok(session);
    }

    /// <summary>Lịch sử upload</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        var result = await _uploadService.GetHistoryAsync(
            GetCurrentDeptCode(), IsAdmin(), page, pageSize);
        return Ok(result);
    }

    /// <summary>Tải về file Excel gốc</summary>
    [HttpGet("{sessionId:guid}/download")]
    public async Task<IActionResult> Download(Guid sessionId)
    {
        var stream = await _uploadService.DownloadOriginalAsync(
            sessionId, GetCurrentDeptCode(), IsAdmin());

        if (stream == null) return NotFound();

        var session = await _uploadService.GetSessionAsync(sessionId, GetCurrentDeptCode(), IsAdmin());
        return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            session?.FileName ?? "export.xlsx");
    }

    private Guid GetCurrentUserId() =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());

    private string GetCurrentDeptCode() =>
        User.FindFirst("dept")?.Value ?? "";

    private bool IsAdmin() =>
        User.IsInRole("SystemAdmin");
}
