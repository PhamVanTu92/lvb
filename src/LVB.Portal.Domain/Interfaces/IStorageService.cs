namespace LVB.Portal.Domain.Interfaces;

public interface IStorageService
{
    Task<string> UploadAsync(Stream fileStream, string objectKey, string contentType, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string objectKey, CancellationToken ct = default);
    Task DeleteAsync(string objectKey, CancellationToken ct = default);
    Task<string> GetPresignedUrlAsync(string objectKey, int expiryMinutes = 60);
}
