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
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri("https://api.sentinelpulse.local")
            };
        }

        public async Task<bool> EnrollAsync(string enrollmentToken, string hardwareId)
        {
            try
            {
                var payload = new { token = enrollmentToken, hardware_id = hardwareId };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync("/api/v1/agent/enroll", content);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> SendTelemetryAsync(string deviceToken, SystemMetrics metrics)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/telemetry/ingest");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);
                request.Content = new StringContent(JsonSerializer.Serialize(metrics), Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
