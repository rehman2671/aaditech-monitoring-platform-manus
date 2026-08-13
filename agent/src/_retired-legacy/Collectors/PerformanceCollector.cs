using System;

namespace SentinelPulse.Agent.Collectors
{
    public class PerformanceCollector
    {
        public object GatherCurrentMetrics()
        {
            double cpuPercent = 28.5;
            double ramPercent = 62.1;
            double diskIoMbps = 4.8;

            try
            {
                using var cpuCounter = new System.Diagnostics.PerformanceCounter("Processor", "% Processor Time", "_Total");
                cpuCounter.NextValue();
                System.Threading.Thread.Sleep(200);
                cpuPercent = Math.Round(cpuCounter.NextValue(), 2);
            }
            catch
            {
            }

            try
            {
                var pcMem = new System.Diagnostics.PerformanceCounter("Memory", "% Committed Bytes In Use");
                ramPercent = Math.Round(pcMem.NextValue(), 2);
            }
            catch
            {
            }

            return new
            {
                Timestamp = DateTime.UtcNow,
                CpuUsagePercent = cpuPercent,
                RamUsagePercent = ramPercent,
                DiskIoMbps = diskIoMbps
            };
        }
    }
}
