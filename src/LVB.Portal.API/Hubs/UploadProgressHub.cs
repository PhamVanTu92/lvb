using LVB.Portal.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LVB.Portal.API.Hubs;

[Authorize]
public class UploadProgressHub : Hub<IUploadHub>
{
    private readonly ILogger<UploadProgressHub> _logger;

    public UploadProgressHub(ILogger<UploadProgressHub> logger) => _logger = logger;

    /// <summary>Client gọi để đăng ký nhận progress của 1 upload session</summary>
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"upload_{sessionId}");
        _logger.LogInformation("Client {ConnectionId} joined session: {SessionId}",
            Context.ConnectionId, sessionId);
    }

    public async Task LeaveSession(string sessionId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"upload_{sessionId}");

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("SignalR connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("SignalR disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
