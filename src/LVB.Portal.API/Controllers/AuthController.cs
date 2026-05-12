using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LVB.Portal.API.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService) => _authService = authService;

    /// <summary>Đăng nhập hệ thống</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (response, error) = await _authService.LoginAsync(request);
        if (error != null) return Unauthorized(new { message = error });
        return Ok(response);
    }

    /// <summary>Đăng xuất (client xóa token)</summary>
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout() => Ok(new { message = "Đăng xuất thành công" });

    /// <summary>Lấy thông tin user hiện tại</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new
    {
        Id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
        Username = User.Identity?.Name,
        FullName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value,
        Email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value,
        Role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value,
        DepartmentCode = User.FindFirst("dept")?.Value
    });
}
