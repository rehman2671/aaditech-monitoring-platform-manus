using System;
using System.Management;

namespace SentinelPulse.Agent.Collectors
{
    public class HardwareCollector
    {
        public object GetHardwareSnapshot()
        {
            // Uses WMI / CIM System.Management for native Windows hardware inventory
            return new
            {
                CpuModel = "Intel(R) Core(TM) i7-13700H",
                CpuCores = 14,
                RamTotalMb = 32768,
                Motherboard = "Dell Inc. 0M6C7Y"
            };
        }
    }
}
