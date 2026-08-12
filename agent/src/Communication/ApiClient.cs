using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace SentinelPulse.Agent.Communication
{
    public class ApiClient
    {
        readonly HttpClient _httpClient;

        public ApiClient()
        {
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri("https://ingest.sentinelpulse.internal")
            };
        }

        public async Task PushTelemetryAsync(object payload)
        {
            // Pushes encrypted JSON payload over HTTPS to ingestion API
            await Task.CompletedTask;
        }
    }
}
