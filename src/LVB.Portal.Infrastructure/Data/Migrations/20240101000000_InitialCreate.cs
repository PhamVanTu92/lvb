using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LVB.Portal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "api_keys",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_api_keys", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "departments",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_departments", x => x.code);
                });

            migrationBuilder.CreateTable(
                name: "sheet_table_mappings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sheet_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    table_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    department_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    column_mapping_json = table.Column<string>(type: "jsonb", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sheet_table_mappings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    department_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    locked_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                    table.ForeignKey(
                        name: "fk_users_departments_department_code",
                        column: x => x.department_code,
                        principalTable: "departments",
                        principalColumn: "code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "upload_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    minio_object_key = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    department_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    uploaded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    error_detail = table.Column<string>(type: "text", nullable: true),
                    total_sheets = table.Column<int>(type: "integer", nullable: false),
                    processed_sheets = table.Column<int>(type: "integer", nullable: false),
                    total_rows = table.Column<int>(type: "integer", nullable: false),
                    processed_rows = table.Column<int>(type: "integer", nullable: false),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    hangfire_job_id = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_upload_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_upload_sessions_departments_department_code",
                        column: x => x.department_code,
                        principalTable: "departments",
                        principalColumn: "code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_upload_sessions_users_uploaded_by",
                        column: x => x.uploaded_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "upload_sheet_results",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    upload_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sheet_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    mapped_table_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    total_rows = table.Column<int>(type: "integer", nullable: false),
                    inserted_rows = table.Column<int>(type: "integer", nullable: false),
                    error_detail = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_upload_sheet_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_upload_sheet_results_upload_sessions_upload_session_id",
                        column: x => x.upload_session_id,
                        principalTable: "upload_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Indexes
            migrationBuilder.CreateIndex(name: "ix_users_username", table: "users", column: "username", unique: true);
            migrationBuilder.CreateIndex(name: "ix_users_email", table: "users", column: "email", unique: true);
            migrationBuilder.CreateIndex(name: "ix_users_department_code", table: "users", column: "department_code");
            migrationBuilder.CreateIndex(name: "ix_upload_sessions_department_code", table: "upload_sessions", column: "department_code");
            migrationBuilder.CreateIndex(name: "ix_upload_sessions_uploaded_by", table: "upload_sessions", column: "uploaded_by");
            migrationBuilder.CreateIndex(name: "ix_upload_sheet_results_upload_session_id", table: "upload_sheet_results", column: "upload_session_id");

            // Seed Departments
            migrationBuilder.InsertData("departments", new[] { "code", "name", "is_active", "created_at" }, new object[,]
            {
                { "HD", "Phòng Huy động", true, DateTime.UtcNow },
                { "CV", "Phòng Cho vay", true, DateTime.UtcNow },
                { "NHDT", "Phòng Ngân hàng điện tử", true, DateTime.UtcNow },
                { "TTQT", "Phòng Thanh toán quốc tế", true, DateTime.UtcNow },
                { "THE", "Phòng Thẻ", true, DateTime.UtcNow }
            });

            // Seed Sheet Mappings
            migrationBuilder.InsertData("sheet_table_mappings",
                new[] { "id", "sheet_name", "table_name", "department_code", "column_mapping_json", "is_active", "created_at" },
                new object[,]
                {
                    { Guid.Parse("11111111-1111-1111-1111-111111111101"), "Huy động/Cho vay", "huy_dong_cho_vay", "", @"{""NGAY_SO_LIEU"":""ngay_so_lieu"",""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""TEN_KHACH_HANG"":""ten_khach_hang"",""LOAI_KH"":""loai_kh"",""SO_TAI_KHOAN"":""so_tai_khoan"",""LOAI_TIEN"":""loai_tien"",""SO_DU_QUY_DOI"":""so_du_quy_doi"",""SO_DU_BQ_THANG"":""so_du_bq_thang"",""MA_CIF_CBNV 1"":""ma_cif_cbnv1"",""MA_CIF_CBNV2"":""ma_cif_cbnv2""}", true, DateTime.UtcNow },
                    { Guid.Parse("11111111-1111-1111-1111-111111111102"), "Ngân hàng điện tử", "ngan_hang_dien_tu", "", @"{""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""Tên KH"":""ten_kh"",""SO_TAI_KHOAN"":""so_tai_khoan"",""MA_CIF_CBNV"":""ma_cif_cbnv"",""Loại chỉ tiêu"":""loai_chi_tieu"",""NGAY_SO_LIEU"":""ngay_so_lieu"",""DS_THUC_HIEN"":""ds_thuc_hien"",""THU  NHAP"":""thu_nhap""}", true, DateTime.UtcNow },
                    { Guid.Parse("11111111-1111-1111-1111-111111111103"), "Mở CIF mới", "mo_cif_moi", "", @"{""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""Tên KH"":""ten_kh"",""Loai_KH"":""loai_kh"",""MA_CIF_CBNV"":""ma_cif_cbnv"",""NGAY_MO_CIF"":""ngay_mo_cif"",""MA_CIF_GT"":""ma_cif_gt"",""MA_CIF_QL"":""ma_cif_ql""}", true, DateTime.UtcNow },
                    { Guid.Parse("11111111-1111-1111-1111-111111111104"), "Thu nhập ròng dịch vụ", "thu_nhap_rong_dich_vu", "", @"{""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""Tên KH"":""ten_kh"",""SO_TAI_KHOAN"":""so_tai_khoan"",""MA_CIF_CBNV"":""ma_cif_cbnv"",""NGAY_SO_LIEU"":""ngay_so_lieu"",""DS_THUC_HIEN"":""ds_thuc_hien"",""THU  NHAP"":""thu_nhap""}", true, DateTime.UtcNow },
                    { Guid.Parse("11111111-1111-1111-1111-111111111105"), "Thanh toán quốc tế", "thanh_toan_quoc_te", "", @"{""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""Tên KH"":""ten_kh"",""SO_TAI_KHOAN"":""so_tai_khoan"",""MA_CIF_CBNV"":""ma_cif_cbnv"",""DS_THUC_HIEN"":""ds_thuc_hien"",""LOAI_TIEN"":""loai_tien"",""TY_GIA"":""ty_gia"",""THU NHAP"":""thu_nhap""}", true, DateTime.UtcNow },
                    { Guid.Parse("11111111-1111-1111-1111-111111111106"), "Phát hành thẻ", "phat_hanh_the", "", @"{""MA_DON_VI"":""ma_don_vi"",""MA_KHACH_HANG"":""ma_khach_hang"",""Tên KH"":""ten_kh"",""SO_TAI_KHOAN"":""so_tai_khoan"",""MA_CIF_CBNV"":""ma_cif_cbnv"",""NGAY_PHAT_HANH"":""ngay_phat_hanh"",""Loại thẻ"":""loai_the"",""Số lượng"":""so_luong""}", true, DateTime.UtcNow }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "upload_sheet_results");
            migrationBuilder.DropTable(name: "upload_sessions");
            migrationBuilder.DropTable(name: "users");
            migrationBuilder.DropTable(name: "departments");
            migrationBuilder.DropTable(name: "sheet_table_mappings");
            migrationBuilder.DropTable(name: "api_keys");
        }
    }
}
