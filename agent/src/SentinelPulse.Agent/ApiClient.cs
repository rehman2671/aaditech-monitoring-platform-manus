using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace SentinelPulse.Agent
{
    public class ApiClient
    {
        private readonly HttpClient _httpClient;

        public ApiClient()
        {
            var configuredBaseUrl = Environment.GetEnvironmentVariable("SENTINELPULSE_API_BASE_URL");
            if (string.IsNullOrWhiteSpace(configuredBaseUrl) ||
                !Uri.TryCreate(configuredBaseUrl.TrimEnd('/') + "/", UriKind.Absolute, out var baseUri) ||
                (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException(
                    "SENTINELPULSE_API_BASE_URL must be configured with an absolute http(s) URL.");
            }

            _httpClient = new HttpClient
            {
                BaseAddress = baseUri,
                Timeout = TimeSpan.FromSeconds(30)
            };
        }

        public async Task<string?> EnrollAsync(string enrollmentToken, string endpointId, string hostname)
        {
            if (string.IsNullOrWhiteSpace(enrollmentToken) || string.IsNullOrWhiteSpace(endpointId))
            {
                return null;
            }

            try
            {
                var payload = new
                {
                    token = enrollmentToken,
                    endpoint_id = endpointId,
                    hostname
                };
                using var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");
                using var response = await _httpClient.PostAsync("api/v1/agent/enroll", content);
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }

                await using var responseStream = await response.Content.ReadAsStreamAsync();
                using var document = await JsonDocument.ParseAsync(responseStream);
                return document.RootElement.TryGetProperty("device_token", out var deviceToken)
                    ? deviceToken.GetString()
                    : null;
            }
            catch
            {
                return null;
            }
        }

        public async Task<bool> SendTelemetryAsync(
            string deviceToken,
            string endpointId,
            long sequenceNumber,
            SystemMetrics metrics)
        {
            if (string.IsNullOrWhiteSpace(deviceToken) || string.IsNullOrWhiteSpace(endpointId))
            {
                return false;
            }

            try
            {
                var envelope = new
                {
                    schema_version = "1.0",
                    event_id = Guid.NewGuid().ToString("N"),
                    endpoint_id = endpointId,
                    sequence_number = sequenceNumber,
                    capture_time = DateTimeOffset.UtcNow.ToString("O"),
                    module = "system",
                    payload = metrics
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, "api/v1/telemetry");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);
                request.Content = new StringContent(
                    JsonSerializer.Serialize(envelope),
                    Encoding.UTF8,
                    "application/json");

                using var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
