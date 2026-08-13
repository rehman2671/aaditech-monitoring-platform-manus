using System;
using System.Collections.Generic;
using System.Management;

namespace SentinelPulse.Agent.Collectors
{
    public class CompleteHardwareCollector
    {
        public Dictionary<string, object> CollectAllHardware()
        {
            var data = new Dictionary<string, object>();
            
            // 1. CPU
            try
            {
                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    data["cpu_model"] = queryObj["Name"]?.ToString() ?? "Unknown";
                    data["cpu_cores"] = Convert.ToInt32(queryObj["NumberOfCores"] ?? 0);
                    data["cpu_threads"] = Convert.ToInt32(queryObj["NumberOfLogicalProcessors"] ?? 0);
                    data["cpu_clock_mhz"] = Convert.ToInt32(queryObj["MaxClockSpeed"] ?? 0);
                }
            }
            catch (Exception ex)
            {
                data["cpu_error"] = ex.Message;
            }

            // 2. GPU & VRAM
            try
            {
                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, AdapterRAM FROM Win32_VideoController");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    data["gpu_model"] = queryObj["Name"]?.ToString() ?? "Unknown";
                    long ramBytes = Convert.ToInt64(queryObj["AdapterRAM"] ?? 0);
                    data["gpu_vram_mb"] = ramBytes > 0 ? (int)(ramBytes / (1024 * 1024)) : 0;
                    break;
                }
            }
            catch (Exception ex)
            {
                data["gpu_error"] = ex.Message;
            }

            // 3. Battery
            try
            {
                using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT EstimatedChargeRemaining, BatteryStatus, DesignCapacity, FullChargeCapacity FROM Win32_Battery");
                foreach (ManagementObject queryObj in searcher.Get())
                {
                    data["battery_charge"] = Convert.ToInt32(queryObj["EstimatedChargeRemaining"] ?? 0);
                    data["battery_status"] = Convert.ToInt32(queryObj["BatteryStatus"] ?? 1);
                    break;
                }
            }
            catch
            {
                // Desktop or AC powered machine without battery
                data["battery_present"] = false;
            }

            return data;
        }
    }
}
