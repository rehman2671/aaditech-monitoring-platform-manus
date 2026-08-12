using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using SentinelPulse.Agent.Storage;

namespace SentinelPulse.Agent.Communication
{
    public class AgentConfig
    {
        public string EndpointId { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string ApiUrl { get; set; } = "https://ingest.sentinelpulse.internal";
    }

    public class ApiClient
    {
        readonly HttpClient _httpClient;
        readonly ILogger<ApiClient> _logger;
        readonly OfflineBuffer _offlineBuffer;
        string? _endpointId;
        string? _apiKey;

        public ApiClient(ILogger<ApiClient> logger)
        {
            _logger = logger;
            _offlineBuffer = new OfflineBuffer();
            
            var config = LoadConfig();
            _endpointId = config.EndpointId;
            _apiKey = config.ApiKey;

            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(config.ApiUrl)
            };

            if (!string.IsNullOrEmpty(_endpointId) && !string.IsNullOrEmpty(_apiKey))
            {
                ConfigureCredentials(_endpointId, _apiKey);
            }
        }

        private static AgentConfig LoadConfig()
        {
            try
            {
                var configPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelPulse", "agent.json");
                if (File.Exists(configPath))
                {
                    var json = File.ReadAllText(configPath);
                    return JsonSerializer.Deserialize<AgentConfig>(json) ?? new AgentConfig();
                }
            }
            catch
            {
            }
            return new AgentConfig();
        }

        public void ConfigureCredentials(string endpointId, string apiKey)
        {
            _endpointId = endpointId;
            _apiKey = apiKey;
            _httpClient.DefaultRequestHeaders.Remove("X-Endpoint-ID");
            _httpClient.DefaultRequestHeaders.Remove("X-Endpoint-API-Key");
            _httpClient.DefaultRequestHeaders.Add("X-Endpoint-ID", endpointId);
            _httpClient.DefaultRequestHeaders.Add("X-Endpoint-API-Key", apiKey);
        }

        public async Task PushTelemetryAsync(string module, object payload)
        {
            if (string.IsNullOrEmpty(_endpointId))
            {
                _logger.LogWarning("Agent endpoint ID is not configured. Telemetry buffering locally until enrolled.");
            }

            var json = JsonSerializer.Serialize(payload);
            try
            {
                await SendPayloadDirectAsync(module, json);
                await ReplayBufferedPayloadsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Network transport failure for module {module}. Enqueuing to offline buffer.", module);
                _offlineBuffer.Enqueue(module, json);
            }
        }

        private async Task SendPayloadDirectAsync(string module, string json)
        {
            var content = JsonContent.Create(new
            {
                schema_version = "1.0",
                event_id = Guid.NewGuid().ToString(),
                endpoint_id = _endpointId ?? "pending-enrollment",
                module = module,
                captured_at = DateTime.UtcNow,
                payload = JsonSerializer.Deserialize<JsonElement>(json)
            });

            var response = await _httpClient.PostAsync("/api/v1/telemetry", content);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Ingestion API returned status code {response.StatusCode}");
            }
        }

        private async Task ReplayBufferedPayloadsAsync()
        {
            var ready = _offlineBuffer.DequeueReady(10);
            foreach (var item in ready)
            {
                try
                {
                    await SendPayloadDirectAsync(item.Module, item.PayloadJson);
                    _offlineBuffer.Acknowledge(item.Id);
                    _logger.LogInformation("Successfully replayed buffered payload {id} for module {module}", item.Id, item.Module);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Replay failed for buffered payload {id}. Retrying backoff.", item.Id);
                    _offlineBuffer.Retry(item.Id, ex.Message);
                }
            }
        }
    }
}
