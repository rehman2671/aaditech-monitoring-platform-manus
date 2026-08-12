using System;
using System.IO;
using Xunit;
using SentinelPulse.Agent.Storage;

namespace SentinelPulse.Agent.Tests
{
    public class OfflineBufferTests
    {
        [Fact]
        public void OfflineBuffer_EnqueueDequeueAndAcknowledge_WorksSuccessfully()
        {
            var dbPath = Path.Combine(Path.GetTempPath(), $"sentinel_test_{Guid.NewGuid()}.db");
            try
            {
                using var buffer = new OfflineBuffer(dbPath, System.Security.Cryptography.DataProtectionScope.CurrentUser);
                buffer.Enqueue("cpu", "{\"cpu_percent\": 75}");

                var ready = buffer.DequeueReady(10);
                Assert.Single(ready);
                Assert.Equal("cpu", ready[0].Module);
                Assert.Contains("75", ready[0].PayloadJson);

                buffer.Acknowledge(ready[0].Id);
                var empty = buffer.DequeueReady(10);
                Assert.Empty(empty);
            }
            finally
            {
                if (File.Exists(dbPath)) File.Delete(dbPath);
            }
        }

        [Fact]
        public void OfflineBuffer_RetryBackoffAndDeadLetter_PromotesAfterMaxAttempts()
        {
            var dbPath = Path.Combine(Path.GetTempPath(), $"sentinel_test_{Guid.NewGuid()}.db");
            try
            {
                using var buffer = new OfflineBuffer(dbPath, System.Security.Cryptography.DataProtectionScope.CurrentUser);
                buffer.Enqueue("memory", "{\"ram_percent\": 80}");

                var ready = buffer.DequeueReady(10);
                Assert.Single(ready);

                // Retry 5 times to push into dead letter queue
                for (int i = 0; i < 5; i++)
                {
                    buffer.Retry(ready[0].Id, "Simulated network timeout", maxAttempts: 5);
                }

                var remaining = buffer.DequeueReady(10);
                Assert.Empty(remaining);
            }
            finally
            {
                if (File.Exists(dbPath)) File.Delete(dbPath);
            }
        }
    }
}
