using LVB.Portal.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;

namespace LVB.Portal.Infrastructure.Services;

public class MinioStorageService : IStorageService
{
    private readonly IMinioClient _minio;
    private readonly string _bucketName;
    private readonly ILogger<MinioStorageService> _logger;

    public MinioStorageService(IMinioClient minio, IConfiguration config, ILogger<MinioStorageService> logger)
    {
        _minio = minio;
        _bucketName = config["MinIO:BucketName"] ?? "lvb-excel-uploads";
        _logger = logger;
    }

    public async Task<string> UploadAsync(Stream fileStream, string objectKey, string contentType, CancellationToken ct = default)
    {
        // Ensure bucket exists
        var bucketExists = await _minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucketName), ct);
        if (!bucketExists)
        {
            await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName), ct);
            _logger.LogInformation("Created MinIO bucket: {Bucket}", _bucketName);
        }

        var putArgs = new PutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(objectKey)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType);

        await _minio.PutObjectAsync(putArgs, ct);
        _logger.LogInformation("Uploaded to MinIO: {ObjectKey}", objectKey);

        return objectKey;
    }

    public async Task<Stream> DownloadAsync(string objectKey, CancellationToken ct = default)
    {
        var ms = new MemoryStream();
        var getArgs = new GetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(objectKey)
            .WithCallbackStream(stream => stream.CopyTo(ms));

        await _minio.GetObjectAsync(getArgs, ct);
        ms.Position = 0;
        return ms;
    }

    public async Task DeleteAsync(string objectKey, CancellationToken ct = default)
    {
        var removeArgs = new RemoveObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(objectKey);
        await _minio.RemoveObjectAsync(removeArgs, ct);
    }

    public async Task<string> GetPresignedUrlAsync(string objectKey, int expiryMinutes = 60)
    {
        var args = new PresignedGetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(objectKey)
            .WithExpiry(expiryMinutes * 60);
        return await _minio.PresignedGetObjectAsync(args);
    }
}
