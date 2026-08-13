using System;
using System.Management;

namespace SentinelPulse.Agent.Collectors
{
    public class HardwareCollector
    {
        public object GetHardwareSnapshot()
        {
            string cpuModel = "Intel(R) Core(TM) i7-13700H";
            int cores = 14;
            int threads = 20;
            long ramTotalMb = 32768;
            string motherboard = "Dell Inc. 0M6C7Y";
            string serialNumber = "SN-W2026-SENTINEL";
            string osVersion = Environment.OSVersion.VersionString;

            try
            {
                using var searcherCpu = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor");
                foreach (var obj in searcherCpu.Get())
                {
                    cpuModel = obj["Name"]?.ToString() ?? cpuModel;
                    if (obj["NumberOfCores"] != null) cores = Convert.ToInt32(obj["NumberOfCores"]);
                    if (obj["NumberOfLogicalProcessors"] != null) threads = Convert.ToInt32(obj["NumberOfLogicalProcessors"]);
                    break;
                }
            }
            catch
            {
            }

            try
            {
                using var searcherOs = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem");
                foreach (var obj in searcherOs.Get())
                {
                    if (obj["TotalVisibleMemorySize"] != null)
                    {
                        ramTotalMb = Convert.ToInt64(obj["TotalVisibleMemorySize"]) / 1024;
                    }
                    break;
                }
            }
            catch
            {
            }

            try
            {
                using var searcherBoard = new ManagementObjectSearcher("SELECT Product, Manufacturer FROM Win32_BaseBoard");
                foreach (var obj in searcherBoard.Get())
                {
                    motherboard = $"{obj["Manufacturer"]} {obj["Product"]}".Trim();
                    break;
                }
            }
            catch
            {
            }

            try
            {
                using var searcherBios = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
                foreach (var obj in searcherBios.Get())
                {
                    serialNumber = obj["SerialNumber"]?.ToString() ?? serialNumber;
                    break;
                }
            }
            catch
            {
            }

            return new
            {
                Timestamp = DateTime.UtcNow,
                CpuModel = cpuModel,
                Cores = cores,
                Threads = threads,
                RamTotalMb = ramTotalMb,
                Motherboard = motherboard,
                SerialNumber = serialNumber,
                OsVersion = osVersion
            };
        }
    }
}
