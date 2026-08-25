using System;
using System.Management;
using System.Text.Json.Serialization;

namespace SentinelPulse.Agent
{
    public class SystemMetrics
    {
        [JsonPropertyName("cpu_utilization")]
        public double? CpuUtilization { get; set; }

        [JsonPropertyName("ram_utilization")]
        public double? RamUtilization { get; set; }

        [JsonPropertyName("disk_utilization")]
        public double? DiskUtilization { get; set; }

        [JsonPropertyName("temperature_c")]
        public double? TemperatureC { get; set; }

        [JsonPropertyName("hostname")]
        public string Hostname { get; set; } = Environment.MachineName;

        [JsonPropertyName("captured_at")]
        public long CapturedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public class WmiCollectors
    {
        public SystemMetrics CollectMetrics()
        {
            var metrics = new SystemMetrics();

            try
            {
                // CPU Utilization via WMI Win32_Processor LoadPercentage
                var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT LoadPercentage FROM Win32_Processor");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    if (queryObj["LoadPercentage"] != null)
                    {
                        metrics.CpuUtilization = Convert.ToDouble(queryObj["LoadPercentage"]);
                    }
                }
            }
            catch
            {
                // Preserve unavailable evidence as null; never invent a utilization value.
                metrics.CpuUtilization = null;
            }

            try
            {
                // RAM Utilization via Win32_OperatingSystem TotalVisibleMemorySize & FreePhysicalMemory
                var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    ulong total = Convert.ToUInt64(queryObj["TotalVisibleMemorySize"]);
                    ulong free = Convert.ToUInt64(queryObj["FreePhysicalMemory"]);
                    if (total > 0)
                    {
                        ulong used = total - free;
                        metrics.RamUtilization = Math.Round((double)used / total * 100.0, 2);
                    }
                }
            }
            catch
            {
                // Preserve unavailable evidence as null; never invent a utilization value.
                metrics.RamUtilization = null;
            }

            try
            {
                // Disk Utilization via Win32_LogicalDisk
                var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Size, FreeSpace FROM Win32_LogicalDisk WHERE DeviceID='C:'");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    ulong size = Convert.ToUInt64(queryObj["Size"]);
                    ulong free = Convert.ToUInt64(queryObj["FreeSpace"]);
                    if (size > 0)
                    {
                        ulong used = size - free;
                        metrics.DiskUtilization = Math.Round((double)used / size * 100.0, 2);
                    }
                }
            }
            catch
            {
                // Preserve unavailable evidence as null; never invent a utilization value.
                metrics.DiskUtilization = null;
            }

            // Temperature is not universally exposed by WMI; null is the truthful state.
            metrics.TemperatureC = null;
            return metrics;
        }
    }
}
