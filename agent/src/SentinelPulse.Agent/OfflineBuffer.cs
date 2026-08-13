using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace SentinelPulse.Agent
{
    public class OfflineBuffer
    {
        private readonly string _dbPath;

        public OfflineBuffer()
        {
            var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var dir = Path.Combine(programData, "SentinelPulse");
            Directory.CreateDirectory(dir);
            _dbPath = Path.Combine(dir, "offline_buffer.db");
            InitializeDatabase();
        }

        private void InitializeDatabase()
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath}");
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = @"
                CREATE TABLE IF NOT EXISTS telemetry_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
            ";
            command.ExecuteNonQuery();
        }

        public void Enqueue(string payload)
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath}");
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO telemetry_queue (payload, created_at) VALUES (@payload, @createdAt)";
            command.Parameters.AddWithValue("@payload", payload);
            command.Parameters.AddWithValue("@createdAt", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            command.ExecuteNonQuery();
        }

        public void SaveEncryptedCredential(string credential)
        {
            var data = Encoding.UTF8.GetBytes(credential);
            var encrypted = ProtectedData.Protect(data, null, DataProtectionScope.LocalMachine);
            var configPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelPulse", "agent.json");
            File.WriteAllBytes(configPath, encrypted);
        }

        public string? LoadEncryptedCredential()
        {
            try
            {
                var configPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelPulse", "agent.json");
                if (!File.Exists(configPath)) return null;
                var encrypted = File.ReadAllBytes(configPath);
                var decrypted = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
                return Encoding.UTF8.GetString(decrypted);
            }
            catch
            {
                return null;
            }
        }
    }
}
