using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SentinelPulse.Agent
{
    public class Worker : BackgroundService
    {
        private readonly ILogger<Worker> _logger;
        private readonly WmiCollectors _collectors;
        private readonly ApiClient _apiClient;
        private readonly OfflineBuffer _buffer;

        public Worker(ILogger<Worker> logger, WmiCollectors collectors, ApiClient apiClient, OfflineBuffer buffer)
        {
            _logger = logger;
            _collectors = collectors;
            _apiClient = apiClient;
            _buffer = buffer;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("SentinelPulse Agent service starting up.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var metrics = _collectors.CollectMetrics();
                    var token = _buffer.LoadEncryptedCredential() ?? "dev-agent-token-placeholder";

                    bool sent = await _apiClient.SendTelemetryAsync(token, metrics);
                    if (!sent)
                    {
                        var payload = System.Text.Json.JsonSerializer.Serialize(metrics);
                        _buffer.Enqueue(payload);
                        _logger.LogWarning("Telemetry transmission failed. Buffered locally.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in agent telemetry polling loop.");
                }

                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }
    }
}
