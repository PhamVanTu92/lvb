using System.ComponentModel.DataAnnotations;
using LVB.Portal.Domain.Enums;

namespace LVB.Portal.Application.DTOs;

public record CreateUserRequest(
    [Required, MaxLength(100)] string Username,
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    UserRole Role,
    [Required] string DepartmentCode
);

public record UpdateUserRequest(
    string? FullName,
    string? Email,
    UserRole? Role,
    string? DepartmentCode,
    bool? IsActive
);

public record UserDto(
    Guid Id,
    string Username,
    string FullName,
    string Email,
    string Role,
    string DepartmentCode,
    string DepartmentName,
    bool IsActive,
    DateTime CreatedAt
);

public record PagedResult<T>(
    IEnumerable<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
