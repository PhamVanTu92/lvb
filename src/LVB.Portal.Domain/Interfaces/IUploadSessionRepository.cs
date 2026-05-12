using LVB.Portal.Domain.Entities;
using LVB.Portal.Domain.Enums;

namespace LVB.Portal.Domain.Interfaces;

public interface IUploadSessionRepository
{
    Task<UploadSession?> GetByIdAsync(Guid id);
    Task<IEnumerable<UploadSession>> GetByDepartmentAsync(string deptCode, int page, int pageSize);
    Task<IEnumerable<UploadSession>> GetByUserAsync(Guid userId, int page, int pageSize);
    Task AddAsync(UploadSession session);
    Task UpdateAsync(UploadSession session);
    Task UpdateStatusAsync(Guid id, UploadStatus status, string? errorDetail = null);
}
