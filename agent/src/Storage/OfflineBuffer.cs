using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace SentinelPulse.Agent.Storage;

public sealed record BufferedPayload(long Id, string Module, string PayloadJson, int Attempts, DateTimeOffset CreatedAt);

public sealed class OfflineBuffer : IDisposable
{
    private readonly string _dbPath;
    private readonly DataProtectionScope _scope;
    private bool _disposed;

    public OfflineBuffer(string? dbPath = null, DataProtectionScope scope = DataProtectionScope.LocalMachine)
    {
        _dbPath = dbPath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelPulse", "Buffer", "telemetry.db");
        _scope = scope;
        var directory = Path.GetDirectoryName(_dbPath) ?? throw new InvalidOperationException("Buffer path has no directory");
        Directory.CreateDirectory(directory);
        Initialize();
    }

    private SqliteConnection OpenConnection()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        var connection = new SqliteConnection($"Data Source={_dbPath};Mode=ReadWriteCreate;Cache=Shared");
        connection.Open();
        return connection;
    }

    private void Initialize()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS queued_payloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module TEXT NOT NULL,
                protected_payload BLOB NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt_at TEXT NOT NULL,
                last_error TEXT NULL
            );
            CREATE TABLE IF NOT EXISTS dead_letter_payloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module TEXT NOT NULL,
                protected_payload BLOB NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER NOT NULL,
                last_error TEXT NOT NULL,
                dead_lettered_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_queue_ready ON queued_payloads(next_attempt_at, id);
        ";
        command.ExecuteNonQuery();
    }

    public void Enqueue(string module, string payloadJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(module);
        ArgumentException.ThrowIfNullOrWhiteSpace(payloadJson);
        var protectedPayload = Protect(payloadJson);
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"INSERT INTO queued_payloads
            (module, protected_payload, created_at, next_attempt_at)
            VALUES ($module, $payload, $createdAt, $nextAttemptAt);";
        command.Parameters.AddWithValue("$module", module);
        command.Parameters.Add("$payload", SqliteType.Blob).Value = protectedPayload;
        command.Parameters.AddWithValue("$createdAt", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$nextAttemptAt", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<BufferedPayload> DequeueReady(int limit = 25)
    {
        limit = Math.Clamp(limit, 1, 500);
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = @"SELECT id, module, protected_payload, created_at, attempts
            FROM queued_payloads WHERE next_attempt_at <= $now ORDER BY id LIMIT $limit;";
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$limit", limit);
        var result = new List<BufferedPayload>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var id = reader.GetInt64(0);
            var module = reader.GetString(1);
            var protectedPayload = (byte[])reader[2];
            var createdAt = DateTimeOffset.Parse(reader.GetString(3));
            var attempts = reader.GetInt32(4);
            try
            {
                result.Add(new BufferedPayload(id, module, Unprotect(protectedPayload), attempts, createdAt));
            }
            catch (CryptographicException ex)
            {
                MoveCorruptToDeadLetter(connection, transaction, id, module, protectedPayload, createdAt, attempts, ex.Message);
            }
        }
        transaction.Commit();
        return result;
    }

    public void Acknowledge(long id)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM queued_payloads WHERE id = $id;";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public bool Retry(long id, string error, int maxAttempts = 5)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(error);
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        using var update = connection.CreateCommand();
        update.Transaction = transaction;
        update.CommandText = "SELECT module, protected_payload, created_at, attempts FROM queued_payloads WHERE id = $id;";
        update.Parameters.AddWithValue("$id", id);
        using var reader = update.ExecuteReader();
        if (!reader.Read()) return false;
        var module = reader.GetString(0);
        var protectedPayload = (byte[])reader[1];
        var createdAt = reader.GetString(2);
        var attempts = reader.GetInt32(3) + 1;
        reader.Close();

        if (attempts >= Math.Max(1, maxAttempts))
        {
            using var dead = connection.CreateCommand();
            dead.Transaction = transaction;
            dead.CommandText = @"INSERT INTO dead_letter_payloads
                (module, protected_payload, created_at, attempts, last_error, dead_lettered_at)
                VALUES ($module, $payload, $createdAt, $attempts, $error, $deadAt);
                DELETE FROM queued_payloads WHERE id = $id;";
            dead.Parameters.AddWithValue("$module", module);
            dead.Parameters.Add("$payload", SqliteType.Blob).Value = protectedPayload;
            dead.Parameters.AddWithValue("$createdAt", createdAt);
            dead.Parameters.AddWithValue("$attempts", attempts);
            dead.Parameters.AddWithValue("$error", error);
            dead.Parameters.AddWithValue("$deadAt", DateTimeOffset.UtcNow.ToString("O"));
            dead.Parameters.AddWithValue("$id", id);
            dead.ExecuteNonQuery();
            transaction.Commit();
            return false;
        }

        var delaySeconds = Math.Min(300, Math.Pow(2, attempts));
        using var retry = connection.CreateCommand();
        retry.Transaction = transaction;
        retry.CommandText = "UPDATE queued_payloads SET attempts = $attempts, next_attempt_at = $next, last_error = $error WHERE id = $id;";
        retry.Parameters.AddWithValue("$attempts", attempts);
        retry.Parameters.AddWithValue("$next", DateTimeOffset.UtcNow.AddSeconds(delaySeconds).ToString("O"));
        retry.Parameters.AddWithValue("$error", error);
        retry.Parameters.AddWithValue("$id", id);
        retry.ExecuteNonQuery();
        transaction.Commit();
        return true;
    }

    public int Cleanup(TimeSpan retention, long maxBytes = 256L * 1024 * 1024)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM queued_payloads WHERE created_at < $cutoff;";
        command.Parameters.AddWithValue("$cutoff", DateTimeOffset.UtcNow.Subtract(retention).ToString("O"));
        var removed = command.ExecuteNonQuery();
        if (new FileInfo(_dbPath).Length > maxBytes) ExecuteQuotaCleanup(connection);
        return removed;
    }

    private void ExecuteQuotaCleanup(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM queued_payloads WHERE id IN (SELECT id FROM queued_payloads ORDER BY id LIMIT 25);";
        command.ExecuteNonQuery();
    }

    private byte[] Protect(string payloadJson) => ProtectedData.Protect(Encoding.UTF8.GetBytes(payloadJson), null, _scope);
    private string Unprotect(byte[] payload) => Encoding.UTF8.GetString(ProtectedData.Unprotect(payload, null, _scope));

    private static void MoveCorruptToDeadLetter(SqliteConnection connection, SqliteTransaction transaction, long id, string module, byte[] payload, DateTimeOffset createdAt, int attempts, string error)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = @"INSERT INTO dead_letter_payloads
            (module, protected_payload, created_at, attempts, last_error, dead_lettered_at)
            VALUES ($module, $payload, $createdAt, $attempts, $error, $deadAt);
            DELETE FROM queued_payloads WHERE id = $id;";
        command.Parameters.AddWithValue("$module", module);
        command.Parameters.Add("$payload", SqliteType.Blob).Value = payload;
        command.Parameters.AddWithValue("$createdAt", createdAt.ToString("O"));
        command.Parameters.AddWithValue("$attempts", attempts);
        command.Parameters.AddWithValue("$error", $"Corrupt encrypted payload: {error}");
        command.Parameters.AddWithValue("$deadAt", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public void Dispose()
    {
        _disposed = true;
    }
}
