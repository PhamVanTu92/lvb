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
builder.Services.AddControllers();
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

// Auto-migrate on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    // Seed default admin user nếu chưa có
    if (!db.Users.Any(u => u.Username == "admin"))
    {
        var pwdSvc = scope.ServiceProvider.GetRequiredService<LVB.Portal.Infrastructure.Services.PasswordService>();
        // Ensure admin department exists
        if (!db.Departments.Any(d => d.Code == "IT"))
            db.Departments.Add(new LVB.Portal.Domain.Entities.Department { Code = "IT", Name = "Phòng IT", IsActive = true, CreatedAt = DateTime.UtcNow });
        db.Users.Add(new LVB.Portal.Domain.Entities.User
        {
            Username = "admin",
            FullName = "System Administrator",
            Email = "admin@lvbank.com",
            PasswordHash = pwdSvc.HashPassword("Admin@2024!"),
            Role = LVB.Portal.Domain.Enums.UserRole.SystemAdmin,
            DepartmentCode = "IT",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
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
