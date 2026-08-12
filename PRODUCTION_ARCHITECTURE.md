# SentinelPulse Production Architecture & Migration Guide

## 1. Executive Summary

SentinelPulse is an enterprise-grade Windows Endpoint Monitoring & Diagnostics Platform designed for high-throughput telemetry ingestion, real-time threshold evaluation, and deep hardware/OS diagnostics. This document outlines the production topology, database migration strategy, Redis stream pipeline, and Windows MSI packaging architecture.

## 2. Core Service Topology

The production architecture consists of four distinct tiers:
1. **Windows Agents (.NET 8)**: Native background services running on endpoints, executing WMI/CIM queries, buffering un-transmitted metrics in local SQLite storage, protecting credentials with Windows DPAPI, and streaming JSON payloads over HTTPS and WebSockets.
2. **Ingestion Gateway (Fastify API)**: Stateless API nodes handling TLS termination, API key validation against Redis cache, rate limiting, and publishing validated telemetry packets to Redis Streams (`telemetry:stream`).
3. **Processing Workers (Node.js)**: Consumer groups reading from Redis Streams, batch-inserting raw metrics into PostgreSQL/TimescaleDB hypertables, evaluating sustained threshold rules (CPU, RAM, Disk, Offline, SMART, Driver), and triggering system alerts.
4. **Dashboard API & Frontend (Fastify / React)**: RBAC-enforced administrative and viewer control plane serving REST/tRPC endpoints, WebSocket event channels, and executive visualization dashboards.

## 3. Database Migration Strategy (PostgreSQL & TimescaleDB)

Production deployments use PostgreSQL 15+ with the TimescaleDB extension enabled. All time-series telemetry tables are converted to TimescaleDB hypertables partitioned by time (`captured_at`).

Migration files are stored under `backend/migrations/`. Each migration is idempotent and includes transactional safety blocks.

## 4. Windows MSI Packaging Architecture

The agent is packaged as a portable `.msi` installer using WiX Toolset v3/v4. The installation sequence:
1. Installs binaries to `C:\Program Files\SentinelPulse\Agent\`.
2. Registers the executable as a Windows Service (`SentinelPulseAgent`) set to Automatic start.
3. Prompts or reads the secure enrollment token / server URL during installation and saves encrypted configuration to `C:\ProgramData\SentinelPulse\agent.json`.
4. Secures credentials using DPAPI machine-key protection.
