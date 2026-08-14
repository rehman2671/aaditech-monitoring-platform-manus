using Microsoft.Win32;

namespace SentinelPulse.Agent;

internal static class AgentConfiguration
{
    private const string RegistryPath = @"Software\SentinelPulse\Agent";

    public static string? Get(string environmentName)
    {
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
            // Registry cleanup below is still attempted; failure is recoverable because
            // the token is single-use and the next service start will not enroll again.
        }

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegistryPath, writable: true);
            key?.DeleteValue("BootstrapEnrollmentToken", throwOnMissingValue: false);
        }
        catch
        {
            // Do not fail an already successful enrollment because cleanup is unavailable.
        }
    }
}
