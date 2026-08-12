using System;
using System.IO;
using Microsoft.Data.Sqlite;

namespace SentinelPulse.Agent.Storage
{
    public class OfflineBuffer
    {
        private readonly string _dbPath;

        public OfflineBuffer(string dbPath = null)
        {
            _dbPath = dbPath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelPulse", "Buffer", "telemetry.db");
            Directory.CreateDirectory(Path.GetDirectoryName(_dbPath));
            Initialize();
        }

        private void Initialize()
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath}");
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = @"
                CREATE TABLE IF NOT EXISTS queued_payloads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    module TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );";
            command.ExecuteNonQuery();
        }

        public void Enqueue(string module, string payloadJson)
        {
            using var connection = new SqliteConnection($"Data Source={_dbPath}");
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO queued_payloads (module, payload, created_at) VALUES (@module, @payload, @createdAt);";
            command.Parameters.AddWithValue("@module", module);
            command.Parameters.AddWithValue("@payload", payloadJson);
            command.Parameters.AddWithValue("@createdAt", DateTime.UtcNow.ToString("o"));
            command.ExecuteNonQuery();
        }
    }
}
