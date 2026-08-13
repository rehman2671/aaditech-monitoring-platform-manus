using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SentinelPulse.Agent
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .UseWindowsService(options =>
                {
                    options.ServiceName = "SentinelPulseAgent";
                })
                .ConfigureServices((hostContext, services) =>
                {
                    services.AddHostedService<Worker>();
                    services.AddSingleton<Collectors.HardwareCollector>();
                    services.AddSingleton<Collectors.PerformanceCollector>();
                    services.AddSingleton<Collectors.OsHealthCollector>();
                    services.AddSingleton<Communication.ApiClient>();
                });
    }
}
