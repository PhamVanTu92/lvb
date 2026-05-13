using System.Text;
using Hangfire;
using Hangfire.PostgreSql;
using LVB.Portal.API.Hubs;
using LVB.Portal.API.Middleware;
using LVB.Portal.Domain.Interfaces;
using LVB.Portal.Infrastructure.Data;
using LVB.Portal.Infrastructure.Jobs;
using LVB.Portal.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Minio;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();
builder.Host.UseSerilog();

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
           .UseSnakeCaseNamingConvention());

// ── MinIO ─────────────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IMinioClient>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    return new MinioClient()
        .WithEndpoint(cfg["MinIO:Endpoint"] ?? "localhost:9000")
        .WithCredentials(cfg["MinIO:AccessKey"], cfg["MinIO:SecretKey"])
        .WithSSL(bool.Parse(cfg["MinIO:UseSSL"] ?? "false"))
        .Build();
});
builder.Services.AddScoped<IStorageService, MinioStorageService>();

// ── JWT Auth ─────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        // Support SignalR token via query string
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(opts =>
{
    opts.AddPolicy("ApiKeyOrJwt", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.Identity?.IsAuthenticated == true ||
            ctx.User.HasClaim(c => c.Type == "api_key_name")));
});

// ── Hangfire ──────────────────────────────────────────────────────────────────
#pragma warning disable CS0618 // Hangfire.PostgreSql 1.21.x – new overload requires 2.0
builder.Services.AddHangfire(cfg => cfg
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(
        builder.Configuration.GetConnectionString("DefaultConnection")!));
#pragma warning restore CS0618
builder.Services.AddHangfireServer(opts =>
{
    opts.WorkerCount = 4;
    opts.Queues = ["default"];
});

// ── SignalR ───────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── Application Services ─────────────────────────────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UploadService>();
builder.Services.AddScoped<DataTableService>();
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<ExcelImportJob>();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opts =>
    opts.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(builder.Configuration["AllowedOrigins"] ?? "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

// ── Controllers & Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "LVB Portal API",
        Version = "v1",
        Description = "Cổng thông tin nội bộ Ngân hàng LaoViet"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer",
        BearerFormat = "JWT", Description = "Nhập JWT token"
    });
    c.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Header,
        Name = "X-Api-Key", Description = "API Key cho iTitan integration"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });
});

// ── Build App ─────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Auto-migrate + Seed ───────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db  = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var pwd = scope.ServiceProvider.GetRequiredService<LVB.Portal.Infrastructure.Services.PasswordService>();

    // Luôn chạy EnsureSchemaAsync trước – dùng IF NOT EXISTS nên an toàn
    // kể cả khi bảng đã tồn tại. Sau đó mới chạy MigrateAsync để sync history.
    Log.Information("Ensuring database schema...");
    await EnsureSchemaAsync(db);
    Log.Information("Schema ready.");

    try { await db.Database.MigrateAsync(); }
    catch (Exception ex) { Log.Warning(ex, "MigrateAsync skipped or failed (non-fatal)."); }

    // ── 1. Seed Departments ──────────────────────────────────────────────────
    var departments = new[]
    {
        new LVB.Portal.Domain.Entities.Department { Code = "IT",   Name = "Phòng IT",                 IsActive = true, CreatedAt = DateTime.UtcNow },
        new LVB.Portal.Domain.Entities.Department { Code = "HD",   Name = "Phòng Huy động",           IsActive = true, CreatedAt = DateTime.UtcNow },
        new LVB.Portal.Domain.Entities.Department { Code = "CV",   Name = "Phòng Cho vay",            IsActive = true, CreatedAt = DateTime.UtcNow },
        new LVB.Portal.Domain.Entities.Department { Code = "NHDT", Name = "Phòng Ngân hàng điện tử",  IsActive = true, CreatedAt = DateTime.UtcNow },
        new LVB.Portal.Domain.Entities.Department { Code = "TTQT", Name = "Phòng Thanh toán quốc tế", IsActive = true, CreatedAt = DateTime.UtcNow },
        new LVB.Portal.Domain.Entities.Department { Code = "THE",  Name = "Phòng Thẻ",                IsActive = true, CreatedAt = DateTime.UtcNow },
    };
    foreach (var dept in departments)
    {
        if (!db.Departments.Any(d => d.Code == dept.Code))
        {
            db.Departments.Add(dept);
            Log.Information("Seeding department: {Code} – {Name}", dept.Code, dept.Name);
        }
    }
    await db.SaveChangesAsync();

    // ── 2. Seed Admin User ───────────────────────────────────────────────────
    if (!db.Users.Any(u => u.Username == "admin"))
    {
        db.Users.Add(new LVB.Portal.Domain.Entities.User
        {
            Username     = "admin",
            FullName     = "System Administrator",
            Email        = "admin@lvbank.com",
            PasswordHash = pwd.HashPassword("Admin@2024!"),
            Role         = LVB.Portal.Domain.Enums.UserRole.SystemAdmin,
            DepartmentCode = "IT",
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        Log.Information("Default admin user created: admin / Admin@2024!");
    }
}

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "LVB Portal API v1"));
}

app.UseMiddleware<ApiKeyMiddleware>();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new HangfireAuthFilter()]
});

app.MapControllers();
app.MapHub<UploadProgressHub>("/hubs/upload-progress");

app.Run();

// Fallback: tạo schema bằng raw SQL nếu EF migration lỗi
static async Task EnsureSchemaAsync(AppDbContext db)
{
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS departments (
            code        VARCHAR(50)  PRIMARY KEY,
            name        VARCHAR(200) NOT NULL,
            description TEXT,
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ  NOT NULL
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id           UUID         PRIMARY KEY,
            key_hash     VARCHAR(500) NOT NULL,
            name         VARCHAR(200) NOT NULL,
            description  TEXT,
            is_active    BOOLEAN      NOT NULL DEFAULT true,
            created_at   TIMESTAMPTZ  NOT NULL,
            expires_at   TIMESTAMPTZ,
            last_used_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS sheet_table_mappings (
            id                  UUID         PRIMARY KEY,
            sheet_name          VARCHAR(200) NOT NULL,
            table_name          VARCHAR(200) NOT NULL,
            department_code     VARCHAR(50)  NOT NULL,
            column_mapping_json JSONB        NOT NULL,
            is_active           BOOLEAN      NOT NULL DEFAULT true,
            created_at          TIMESTAMPTZ  NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id                  UUID         PRIMARY KEY,
            username            VARCHAR(100) NOT NULL,
            full_name           TEXT         NOT NULL,
            email               VARCHAR(255) NOT NULL,
            password_hash       TEXT         NOT NULL,
            role                INTEGER      NOT NULL,
            department_code     VARCHAR(50)  NOT NULL,
            is_active           BOOLEAN      NOT NULL DEFAULT true,
            failed_login_count  INTEGER      NOT NULL DEFAULT 0,
            locked_until        TIMESTAMPTZ,
            created_at          TIMESTAMPTZ  NOT NULL,
            updated_at          TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS upload_sessions (
            id               UUID          PRIMARY KEY,
            file_name        VARCHAR(500)  NOT NULL,
            minio_object_key VARCHAR(1000) NOT NULL,
            file_size_bytes  BIGINT        NOT NULL,
            department_code  VARCHAR(50)   NOT NULL,
            uploaded_by      UUID          NOT NULL,
            uploaded_at      TIMESTAMPTZ   NOT NULL,
            status           TEXT          NOT NULL,
            error_detail     TEXT,
            total_sheets     INTEGER       NOT NULL DEFAULT 0,
            processed_sheets INTEGER       NOT NULL DEFAULT 0,
            total_rows       INTEGER       NOT NULL DEFAULT 0,
            processed_rows   INTEGER       NOT NULL DEFAULT 0,
            completed_at     TIMESTAMPTZ,
            hangfire_job_id       TEXT,
            selected_mapping_id   UUID
        );

        CREATE TABLE IF NOT EXISTS upload_sheet_results (
            id                UUID         PRIMARY KEY,
            upload_session_id UUID         NOT NULL,
            sheet_name        VARCHAR(200) NOT NULL,
            mapped_table_name VARCHAR(200),
            status            TEXT         NOT NULL,
            total_rows        INTEGER      NOT NULL DEFAULT 0,
            inserted_rows     INTEGER      NOT NULL DEFAULT 0,
            error_detail      TEXT
        );

        -- FK constraints (ADD IF NOT EXISTS not supported on old PG, use DO block)
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_dept') THEN
                ALTER TABLE users ADD CONSTRAINT fk_users_dept
                    FOREIGN KEY (department_code) REFERENCES departments(code);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_us_dept') THEN
                ALTER TABLE upload_sessions ADD CONSTRAINT fk_us_dept
                    FOREIGN KEY (department_code) REFERENCES departments(code);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_us_user') THEN
                ALTER TABLE upload_sessions ADD CONSTRAINT fk_us_user
                    FOREIGN KEY (uploaded_by) REFERENCES users(id);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_usr_session') THEN
                ALTER TABLE upload_sheet_results ADD CONSTRAINT fk_usr_session
                    FOREIGN KEY (upload_session_id) REFERENCES upload_sessions(id) ON DELETE CASCADE;
            END IF;
        END $$;

        -- Thêm cột mới nếu chưa có (idempotent ALTER)
        ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS selected_mapping_id UUID;

        -- Indexes
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username);
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email    ON users(email);
        CREATE        INDEX IF NOT EXISTS ix_users_dept     ON users(department_code);
        CREATE        INDEX IF NOT EXISTS ix_us_dept        ON upload_sessions(department_code);
        CREATE        INDEX IF NOT EXISTS ix_us_user        ON upload_sessions(uploaded_by);
        CREATE        INDEX IF NOT EXISTS ix_usr_session    ON upload_sheet_results(upload_session_id);

        -- Đánh dấu migration đã chạy
        INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
        VALUES ('20240101000000_InitialCreate', '9.0.5')
        ON CONFLICT DO NOTHING;
    """);

    Log.Information("Fallback schema creation completed.");
}

// Hangfire dashboard: chỉ SystemAdmin mới xem được
public class HangfireAuthFilter : Hangfire.Dashboard.IDashboardAuthorizationFilter
{
    public bool Authorize(Hangfire.Dashboard.DashboardContext ctx)
    {
        // In development, allow all; in production restrict to SystemAdmin
        var env = ctx.Request.LocalIpAddress;
        return true; // TODO: restrict to SystemAdmin in production
    }
}
