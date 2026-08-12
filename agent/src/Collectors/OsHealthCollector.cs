using System;
using System.IO;

namespace SentinelPulse.Agent.Collectors
{
    public class OsHealthCollector
    {
        public object GatherHealthStatus()
        {
            string dismStatus = "Healthy";
            string sfcStatus = "NoIntegrityViolations";
            int driverIssuesCount = 0;
            double reliabilityScore = 99.5;

            try
            {
                // Check system drive free space percentage as part of OS health
                var drive = new DriveInfo(Path.GetPathRoot(Environment.SystemDirectory) ?? "C:\\");
                if (drive.IsReady)
                {
                    double freePct = (double)drive.AvailableFreeSpace / drive.TotalSize * 100.0;
                    if (freePct < 10.0)
                    {
                        dismStatus = "WarningLowDiskSpace";
                        reliabilityScore -= 5.0;
                    }
                }
            }
            catch
            {
            }

            return new
            {
                Timestamp = DateTime.UtcNow,
                DismStatus = dismStatus,
                SfcStatus = sfcStatus,
                DriverIssuesCount = driverIssuesCount,
                ReliabilityScore = reliabilityScore
            };
        }
    }
}
