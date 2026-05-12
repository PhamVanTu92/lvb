using System.ComponentModel.DataAnnotations;

namespace LVB.Portal.Application.DTOs;

public record LoginRequest(
    [Required] string Username,
    [Required] string Password
);

public record LoginResponse(
    string Token,
    string Username,
    string FullName,
    string Email,
    string Role,
    string DepartmentCode,
    DateTime ExpiresAt
);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword
);
