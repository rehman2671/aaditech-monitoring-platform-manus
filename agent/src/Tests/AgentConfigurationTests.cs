using System;
using System.IO;
using System.Text.Json;
using SentinelPulse.Agent;
using Xunit;

namespace SentinelPulse.Agent.Tests;

public sealed class AgentConfigurationTests
{
    [Fact]
    public void JsonConfigurationOverridesEnvironment()
    {
        var path = WriteConfig(new { serverUrl = "https://json.example", endpointId = "json-endpoint", enrollmentToken = "sp-enrol-json" });
        try
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", "https://environment.example");
            Assert.Equal("https://json.example", AgentConfiguration.Get("SENTINELPULSE_API_BASE_URL", path));
        }
        finally
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", null);
            File.Delete(path);
        }
    }

    [Fact]
    public void EnvironmentIsUsedWhenJsonValueIsMissing()
    {
        var path = WriteConfig(new { endpointId = "json-endpoint" });
        try
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", " https://environment.example/ ");
            Assert.Equal("https://environment.example/", AgentConfiguration.Get("SENTINELPULSE_API_BASE_URL", path));
        }
        finally
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", null);
            File.Delete(path);
        }
    }

    [Fact]
    public void MalformedJsonFallsBackToEnvironment()
    {
        var path = Path.Combine(Path.GetTempPath(), $"sentinel-config-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, "{ malformed");
        try
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_ENDPOINT_ID", "environment-endpoint");
            Assert.Equal("environment-endpoint", AgentConfiguration.Get("SENTINELPULSE_ENDPOINT_ID", path));
        }
        finally
        {
            Environment.SetEnvironmentVariable("SENTINELPULSE_ENDPOINT_ID", null);
            File.Delete(path);
        }
    }

    [Fact]
    public void ClearEnrollmentTokenClearsDocumentedLowerCamelCaseKey()
    {
        var path = WriteConfig(new { enrollmentToken = "sp-enrol-one-time" });
        try
        {
            AgentConfiguration.ClearEnrollmentToken(path);
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            Assert.Equal(string.Empty, doc.RootElement.GetProperty("enrollmentToken").GetString());
        }
        finally
        {
            File.Delete(path);
        }
    }

    private static string WriteConfig(object value)
    {
        var path = Path.Combine(Path.GetTempPath(), $"sentinel-config-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, JsonSerializer.Serialize(value));
        return path;
    }
}
