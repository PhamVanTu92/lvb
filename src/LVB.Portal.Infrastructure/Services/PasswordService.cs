using System.Security.Cryptography;
using System.Text;

namespace LVB.Portal.Infrastructure.Services;

public class PasswordService
{
    public string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        // Simple salted hash – in production consider BCrypt
        var salt = GenerateSalt();
        var combined = $"{salt}:{password}";
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(combined));
        return $"{salt}:{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split(':', 2);
        if (parts.Length != 2) return false;
        var salt = parts[0];
        using var sha256 = SHA256.Create();
        var combined = $"{salt}:{password}";
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(combined));
        return parts[1] == Convert.ToBase64String(hash);
    }

    private static string GenerateSalt()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToBase64String(bytes);
    }
}
