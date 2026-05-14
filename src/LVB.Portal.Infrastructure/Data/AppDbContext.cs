using LVB.Portal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LVB.Portal.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<UploadSession> UploadSessions => Set<UploadSession>();
    public DbSet<UploadSheetResult> UploadSheetResults => Set<UploadSheetResult>();
    public DbSet<SheetTableMapping> SheetTableMappings => Set<SheetTableMapping>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<DatasetField> DatasetFields => Set<DatasetField>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Report> Reports => Set<Report>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Department
        modelBuilder.Entity<Department>(e =>
        {
            e.HasKey(d => d.Code);
            e.Property(d => d.Code).HasMaxLength(50);
            e.Property(d => d.Name).HasMaxLength(200).IsRequired();
        });

        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Username).HasMaxLength(100).IsRequired();
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Email).HasMaxLength(255);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.DepartmentCode).HasMaxLength(50);
            e.HasOne(u => u.Department)
                .WithMany(d => d.Users)
                .HasForeignKey(u => u.DepartmentCode)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // UploadSession
        modelBuilder.Entity<UploadSession>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.FileName).HasMaxLength(500).IsRequired();
            e.Property(s => s.MinioObjectKey).HasMaxLength(1000);
            e.Property(s => s.DepartmentCode).HasMaxLength(50);
            e.Property(s => s.Status).HasConversion<string>();
            e.HasOne(s => s.Department)
                .WithMany(d => d.UploadSessions)
                .HasForeignKey(s => s.DepartmentCode)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(s => s.Uploader)
                .WithMany(u => u.UploadSessions)
                .HasForeignKey(s => s.UploadedBy)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // UploadSheetResult
        modelBuilder.Entity<UploadSheetResult>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.SheetName).HasMaxLength(200);
            e.Property(r => r.MappedTableName).HasMaxLength(200);
            e.Property(r => r.Status).HasConversion<string>();
            e.HasOne(r => r.UploadSession)
                .WithMany(s => s.SheetResults)
                .HasForeignKey(r => r.UploadSessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SheetTableMapping
        modelBuilder.Entity<SheetTableMapping>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.SheetName).HasMaxLength(200);
            e.Property(m => m.TableName).HasMaxLength(200);
            e.Property(m => m.DepartmentCode).HasMaxLength(50);
            e.Property(m => m.ColumnMappingJson).HasColumnType("jsonb");
        });

        // ApiKey
        modelBuilder.Entity<ApiKey>(e =>
        {
            e.HasKey(k => k.Id);
            e.Property(k => k.KeyHash).HasMaxLength(500).IsRequired();
            e.Property(k => k.Name).HasMaxLength(200).IsRequired();
        });

        // DatasetField
        modelBuilder.Entity<DatasetField>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.FieldName).HasMaxLength(100).IsRequired();
            e.Property(f => f.DisplayName).HasMaxLength(200).IsRequired();
            e.Property(f => f.FieldType).HasMaxLength(50);
            e.HasOne(f => f.Mapping)
                .WithMany(m => m.Fields)
                .HasForeignKey(f => f.MappingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Report
        modelBuilder.Entity<Report>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Name).HasMaxLength(300).IsRequired();
            e.Property(r => r.DepartmentCode).HasMaxLength(50);
            e.Property(r => r.ConfigJson).HasColumnType("text").IsRequired();
            e.Property(r => r.CreatedByName).HasMaxLength(200);
            e.HasIndex(r => r.DepartmentCode);
            e.HasIndex(r => r.IsActive);
        });

        // AuditLog
        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasKey(l => l.Id);
            e.Property(l => l.Action).HasMaxLength(100).IsRequired();
            e.Property(l => l.EntityType).HasMaxLength(100).IsRequired();
            e.Property(l => l.EntityId).HasMaxLength(200);
            e.Property(l => l.EntityName).HasMaxLength(500);
            e.Property(l => l.Username).HasMaxLength(200);
            e.Property(l => l.DepartmentCode).HasMaxLength(50);
            e.Property(l => l.IpAddress).HasMaxLength(50);
            e.HasIndex(l => l.CreatedAt);
            e.HasIndex(l => new { l.EntityType, l.EntityId });
            e.HasIndex(l => l.UserId);
        });

        // Seed default departments
        modelBuilder.Entity<Department>().HasData(
            new Department { Code = "HD", Name = "Phòng Huy động", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "CV", Name = "Phòng Cho vay", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "NHDT", Name = "Phòng Ngân hàng điện tử", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "TTQT", Name = "Phòng Thanh toán quốc tế", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "THE", Name = "Phòng Thẻ", IsActive = true, CreatedAt = DateTime.UtcNow }
        );

    }
}
