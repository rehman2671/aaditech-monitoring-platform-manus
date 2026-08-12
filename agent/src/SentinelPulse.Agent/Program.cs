using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SentinelPulse.Agent
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var hostBuilder = Host.CreateDefaultBuilder(args)
                .UseWindowsService(options =>
                {
                    options.ServiceName = "SentinelPulseAgent";
                })
                .ConfigureServices((context, services) =>
                {
                    services.AddSingleton<OfflineBuffer>();
                    services.AddSingleton<ApiClient>();
                    services.AddSingleton<WmiCollectors>();
                    services.AddHostedService<Worker>();
                });

            var host = hostBuilder.Build();
            await host.RunAsync();
        }
    }
}
