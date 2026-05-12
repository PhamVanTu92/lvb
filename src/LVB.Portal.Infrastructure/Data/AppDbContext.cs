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

        // Seed default departments
        modelBuilder.Entity<Department>().HasData(
            new Department { Code = "HD", Name = "Phòng Huy động", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "CV", Name = "Phòng Cho vay", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "NHDT", Name = "Phòng Ngân hàng điện tử", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "TTQT", Name = "Phòng Thanh toán quốc tế", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Department { Code = "THE", Name = "Phòng Thẻ", IsActive = true, CreatedAt = DateTime.UtcNow }
        );

        // Seed default sheet-table mappings (từ FORM DL đầu vào.xlsx)
        modelBuilder.Entity<SheetTableMapping>().HasData(
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111101"),
                SheetName = "Huy động/Cho vay",
                TableName = "huy_dong_cho_vay",
                DepartmentCode = "",
                ColumnMappingJson = """{"NGAY_SO_LIEU":"ngay_so_lieu","MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","TEN_KHACH_HANG":"ten_khach_hang","LOAI_KH":"loai_kh","SO_TAI_KHOAN":"so_tai_khoan","LOAI_TIEN":"loai_tien","SO_DU_QUY_DOI":"so_du_quy_doi","SO_DU_BQ_THANG":"so_du_bq_thang","MA_CIF_CBNV 1":"ma_cif_cbnv1","MA_CIF_CBNV2":"ma_cif_cbnv2"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111102"),
                SheetName = "Ngân hàng điện tử",
                TableName = "ngan_hang_dien_tu",
                DepartmentCode = "",
                ColumnMappingJson = """{"MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","Tên KH":"ten_kh","SO_TAI_KHOAN":"so_tai_khoan","MA_CIF_CBNV":"ma_cif_cbnv","Loại chỉ tiêu":"loai_chi_tieu","NGAY_SO_LIEU":"ngay_so_lieu","DS_THUC_HIEN":"ds_thuc_hien","THU  NHAP":"thu_nhap"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111103"),
                SheetName = "Mở CIF mới",
                TableName = "mo_cif_moi",
                DepartmentCode = "",
                ColumnMappingJson = """{"MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","Tên KH":"ten_kh","Loai_KH":"loai_kh","MA_CIF_CBNV":"ma_cif_cbnv","NGAY_MO_CIF":"ngay_mo_cif","MA_CIF_GT":"ma_cif_gt","MA_CIF_QL":"ma_cif_ql"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111104"),
                SheetName = "Thu nhập ròng dịch vụ",
                TableName = "thu_nhap_rong_dich_vu",
                DepartmentCode = "",
                ColumnMappingJson = """{"MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","Tên KH":"ten_kh","SO_TAI_KHOAN":"so_tai_khoan","MA_CIF_CBNV":"ma_cif_cbnv","NGAY_SO_LIEU":"ngay_so_lieu","DS_THUC_HIEN":"ds_thuc_hien","THU  NHAP":"thu_nhap"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111105"),
                SheetName = "Thanh toán quốc tế",
                TableName = "thanh_toan_quoc_te",
                DepartmentCode = "",
                ColumnMappingJson = """{"MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","Tên KH":"ten_kh","SO_TAI_KHOAN":"so_tai_khoan","MA_CIF_CBNV":"ma_cif_cbnv","DS_THUC_HIEN":"ds_thuc_hien","LOAI_TIEN":"loai_tien","TY_GIA":"ty_gia","THU NHAP":"thu_nhap"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new SheetTableMapping
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111106"),
                SheetName = "Phát hành thẻ",
                TableName = "phat_hanh_the",
                DepartmentCode = "",
                ColumnMappingJson = """{"MA_DON_VI":"ma_don_vi","MA_KHACH_HANG":"ma_khach_hang","Tên KH":"ten_kh","SO_TAI_KHOAN":"so_tai_khoan","MA_CIF_CBNV":"ma_cif_cbnv","NGAY_PHAT_HANH":"ngay_phat_hanh","Loại thẻ":"loai_the","Số lượng":"so_luong"}""",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}
