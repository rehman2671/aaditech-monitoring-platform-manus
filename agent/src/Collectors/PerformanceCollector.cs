using System;

namespace SentinelPulse.Agent.Collectors
{
    public class PerformanceCollector
    {
        public object GatherCurrentMetrics()
        {
            return new
            {
                Timestamp = DateTime.UtcNow,
                CpuUsagePercent = 28.5,
                RamUsagePercent = 62.1,
                DiskIoMbps = 5.2
            };
        }
    }
}
