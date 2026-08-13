using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SentinelPulse.Agent
{
    public class Worker : BackgroundService
    {
        readonly ILogger<Worker> _logger;
        readonly Collectors.HardwareCollector _hardwareCollector;
        readonly Collectors.PerformanceCollector _performanceCollector;
        readonly Communication.ApiClient _apiClient;

        public Worker(
            ILogger<Worker> logger,
            Collectors.HardwareCollector hardwareCollector,
            Collectors.PerformanceCollector performanceCollector,
            Communication.ApiClient apiClient)
        {
            _logger = logger;
            _hardwareCollector = hardwareCollector;
            _performanceCollector = performanceCollector;
            _apiClient = apiClient;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("SentinelPulse Windows Worker Service started at: {time}", DateTimeOffset.Now);

            // Push initial hardware inventory upon startup
            try
            {
                var hardware = _hardwareCollector.GetHardwareSnapshot();
                await _apiClient.PushTelemetryAsync("hardware", hardware);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to push initial hardware inventory.");
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Collecting endpoint telemetry and performance counters...");
                    var metrics = _performanceCollector.GatherCurrentMetrics();
                    await _apiClient.PushTelemetryAsync("performance", metrics);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while gathering or pushing endpoint telemetry.");
                }

                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
        }
    }
}
