using System;
using System.IO;
using System.Text.Json;
using Microsoft.Win32;

namespace SentinelPulse.Agent;

internal static class AgentConfiguration
{
    private const string RegistryPath = @"Software\SentinelPulse\Agent";
    private static readonly string ConfigFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "SentinelPulse",
        "Agent",
        "config.json"
    );

    public static string? Get(string environmentName)
    {
        // 1. Check environment variable first
        var environmentValue = Environment.GetEnvironmentVariable(environmentName);
        if (!string.IsNullOrWhiteSpace(environmentValue))
        {
            return environmentValue.Trim();
        }

        // 2. Check ProgramData JSON config file (enables zero-rebuild server IP / base URL changes)
        try
        {
            if (File.Exists(ConfigFilePath))
            {
                var json = File.ReadAllText(ConfigFilePath);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var jsonKey = environmentName switch
                {
                    "SENTINELPULSE_API_BASE_URL" => "ApiBaseUrl",
                    "SENTINELPULSE_ENDPOINT_ID" => "EndpointId",
                    "SENTINELPULSE_ENROLLMENT_TOKEN" => "EnrollmentToken",
                    _ => null
                };
                if (jsonKey != null && root.TryGetProperty(jsonKey, out var val) && val.ValueKind == JsonValueKind.String)
                {
                    var s = val.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                    {
                        return s.Trim();
                    }
                }
            }
        }
        catch
        {
            // Fallback to registry on any JSON parsing error
        }

        // 3. Check Windows Registry (baked by MSI)
        var registryName = environmentName switch
        {
            "SENTINELPULSE_API_BASE_URL" => "BootstrapApiBaseUrl",
            "SENTINELPULSE_ENDPOINT_ID" => "BootstrapEndpointId",
            "SENTINELPULSE_ENROLLMENT_TOKEN" => "BootstrapEnrollmentToken",
            _ => null
        };
        if (registryName is null)
        {
            return null;
        }

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegistryPath, writable: false);
            return key?.GetValue(registryName) as string;
        }
        catch
        {
            return null;
        }
    }

    public static void ClearEnrollmentToken()
    {
        try
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_ENROLLMENT_TOKEN", null, EnvironmentVariableTarget.Machine);
        }
        catch
        {
        }

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegistryPath, writable: true);
            key?.DeleteValue("BootstrapEnrollmentToken", throwOnMissingValue: false);
        }
        catch
        {
        }

        try
        {
            if (File.Exists(ConfigFilePath))
            {
                var json = File.ReadAllText(ConfigFilePath);
                using var doc = JsonDocument.Parse(json);
                var dict = JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, object>>(json);
                if (dict != null && dict.ContainsKey("EnrollmentToken"))
                {
                    dict["EnrollmentToken"] = "";
                    File.WriteAllText(ConfigFilePath, JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true }));
                }
            }
        }
        catch
        {
        }
    }
}
