using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
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

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static string? Get(string environmentName)
    {
        // The ProgramData JSON file is authoritative so server re-pointing does not
        // require a rebuild and cannot be silently overridden by stale registry data.
        var jsonValue = ReadJsonValue(environmentName);
        if (!string.IsNullOrWhiteSpace(jsonValue))
        {
            return jsonValue.Trim();
        }

        var environmentValue = Environment.GetEnvironmentVariable(environmentName);
        if (!string.IsNullOrWhiteSpace(environmentValue))
        {
            return environmentValue.Trim();
        }

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
            var value = key?.GetValue(registryName) as string;
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadJsonValue(string environmentName)
    {
        var jsonKey = environmentName switch
        {
            "SENTINELPULSE_API_BASE_URL" => "serverUrl",
            "SENTINELPULSE_ENDPOINT_ID" => "endpointId",
            "SENTINELPULSE_ENROLLMENT_TOKEN" => "enrollmentToken",
            _ => null
        };
        if (jsonKey is null || !File.Exists(ConfigFilePath))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(ConfigFilePath));
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            // Accept both the documented lower-camel-case contract and legacy
            // PascalCase files already provisioned by earlier MSI builds.
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (!string.Equals(property.Name, jsonKey, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                return property.Value.ValueKind == JsonValueKind.String ? property.Value.GetString() : null;
            }
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }

        return null;
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
            if (!File.Exists(ConfigFilePath))
            {
                return;
            }

            var root = JsonNode.Parse(File.ReadAllText(ConfigFilePath)) as JsonObject;
            if (root is null)
            {
                return;
            }

            foreach (var propertyName in new[] { "enrollmentToken", "EnrollmentToken" })
            {
                if (root.ContainsKey(propertyName))
                {
                    root[propertyName] = string.Empty;
                }
            }

            File.WriteAllText(ConfigFilePath, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (JsonException)
        {
        }
        catch (IOException)
        {
        }
    }
}
