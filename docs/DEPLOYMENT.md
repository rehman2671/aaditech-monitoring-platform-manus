# SentinelPulse Deployment Guide

## 1. Primary Target: Docker Compose

The primary self-hosted production deployment relies on Docker Compose to orchestrate the PostgreSQL/TimescaleDB container, Redis Streams container, and Go canonical backend container.

### 1.1 Service Architecture
- **PostgreSQL (`timescale/timescaledb:latest-pg15`)**: Persistent relational and hypertable storage, initialized via `/backend/migrations/`.
- **Redis (`redis:7-alpine`)**: Durable telemetry stream queue and consumer group coordination.
- **Go Backend (`sentinelpulse-backend`)**: Ingestion, API routing, authentication, alert evaluation, and command dispatch.

### 1.2 Operational Runbook
- **Startup**: Run `docker compose -f infra/docker-compose.prod.yml up -d`.
- **Health Checks**: PostgreSQL and Redis expose automated health probes (`pg_isready` and `redis-cli ping`), ensuring the Go backend starts only after dependencies are healthy.
- **Backups**: Standard PostgreSQL `pg_dump` and TimescaleDB snapshot routines protect relational and time-series data.

---

## 2. Secondary Target: Kubernetes

For enterprise clusters, Helm or native Kubernetes manifests deploy the platform across stateless API pods, stateful TimescaleDB, and Redis clusters.
- **StatefulSet**: PostgreSQL + TimescaleDB with persistent volume claims.
- **Deployment**: Go API pods configured with horizontal pod autoscaling (HPA) based on CPU and request latency.
- **Secrets Management**: Kubernetes Secrets injected securely via environment variables or volume mounts, avoiding plaintext configuration.
