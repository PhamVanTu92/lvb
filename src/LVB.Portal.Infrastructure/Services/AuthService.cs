using LVB.Portal.Application.DTOs;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LVB.Portal.Infrastructure.Services;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly PasswordService _passwordService;
    private readonly JwtService _jwtService;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        AppDbContext db,
        PasswordService passwordService,
        JwtService jwtService,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _db = db;
        _passwordService = passwordService;
        _jwtService = jwtService;
        _config = config;
        _logger = logger;
    }

    public async Task<(LoginResponse? Response, string? Error)> LoginAsync(LoginRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user == null)
        {
            _logger.LogWarning("Login failed: user not found {Username}", request.Username);
            return (null, "Tên đăng nhập hoặc mật khẩu không đúng");
        }

        // Check if account is locked
        if (user.LockedUntil.HasValue && user.LockedUntil > DateTime.UtcNow)
        {
            var remaining = (user.LockedUntil.Value - DateTime.UtcNow).Minutes;
            return (null, $"Tài khoản bị khóa. Thử lại sau {remaining} phút.");
        }

        if (!_passwordService.VerifyPassword(request.Password, user.PasswordHash))
        {
            user.FailedLoginCount++;
            var maxAttempts = int.Parse(_config["Auth:MaxLoginAttempts"] ?? "5");
            var lockMinutes = int.Parse(_config["Auth:LockDurationMinutes"] ?? "30");

            if (user.FailedLoginCount >= maxAttempts)
            {
                user.LockedUntil = DateTime.UtcNow.AddMinutes(lockMinutes);
                user.FailedLoginCount = 0;
                _logger.LogWarning("Account locked for {Username}", user.Username);
            }

            await _db.SaveChangesAsync();
            return (null, "Tên đăng nhập hoặc mật khẩu không đúng");
        }

        // Reset failed attempts on success
        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        await _db.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user);
        var expiryMinutes = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "480");

        return (new LoginResponse(
            Token: token,
            Username: user.Username,
            FullName: user.FullName,
            Email: user.Email,
            Role: user.Role.ToString(),
            DepartmentCode: user.DepartmentCode,
            ExpiresAt: DateTime.UtcNow.AddMinutes(expiryMinutes)
        ), null);
    }
}
