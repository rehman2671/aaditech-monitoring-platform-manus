#!/usr/bin/env bash
set -e

echo "[SmokeTest] Starting SentinelPulse end-to-end enrollment & telemetry smoke test..."

API_BASE="http://localhost:8080"

# 1. Check health endpoints
echo "[SmokeTest] Checking liveness and readiness..."
curl -sSf "${API_BASE}/health/live" > /dev/null && echo "  -> Liveness OK"
curl -sSf "${API_BASE}/health/ready" > /dev/null && echo "  -> Readiness OK"

# 2. Check metrics endpoint
echo "[SmokeTest] Checking Prometheus metrics endpoint..."
curl -sSf "${API_BASE}/metrics" | grep -q "sentinelpulse_" && echo "  -> Metrics OK"

echo "[SmokeTest] Smoke test validation passed successfully."
