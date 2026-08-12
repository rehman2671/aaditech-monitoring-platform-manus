# SentinelPulse Production Gap Analysis

## 1. Executive Summary

This document records the exact evidence-based gap analysis between the repository's current state and the target production architecture. It establishes the authoritative checklist for subsequent implementation phases.

## 2. Requirement vs. Current State Matrix

| Architectural Area | Target Requirement | Current Repository Status | Remediation Required |
|---|---|---|---|
| **Backend Service** | Canonical Go backend service | Express + tRPC + Fastify scaffolds (TypeScript) | Implement Go API backend and retire legacy Express/Fastify API paths |
| **Database** | PostgreSQL + TimescaleDB | Drizzle MySQL schema (`drizzle/schema.ts`) | Rewrite Drizzle schema for PostgreSQL/TimescaleDB hypertables |
| **Queue** | Redis Streams with consumer groups | Local JSON files and memory queues | Implement Redis Streams producer and worker consumer groups |
| **Agent Transport** | Enrollment-authenticated HTTPS + ACKs | Stub `ApiClient.cs` with hardcoded URL | Implement secure HTTPS transport with idempotency and ACK parsing |
| **Collectors** | Real WMI/CIM/performance counters | Fixed constant return values in collector stubs | Implement native WMI/CIM sampling for all hardware/performance modules |
| **Offline Buffer** | DPAPI + SQLite durable queue & replay | Isolated SQLite buffer class not wired to Worker | Integrate offline buffer into Worker main loop and transport client |
| **Installer** | Versioned WiX v4 MSI with upgrade rules | WiX source file present; build pipeline blocked in Linux | Implement automated Windows CI publish & MSI compilation workflow |
| **Multi-Tenancy** | Authenticated organization scope on all queries | Default `org-enterprise-01` string literal in queries | Enforce organization membership middleware and mandatory query predicates |
| **Authentication** | Secure production session / token auth | Preview session storage fallback in `App.tsx` | Remove production preview bypass and enforce strict session validation |
| **Alert Lifecycle** | Persisted NORMAL → RESOLVED state machine | In-memory/file evaluation without persistent lifecycle | Implement full alert lifecycle, sustained duration rules, and DB persistence |
| **Audit Logs** | Immutable administrative audit records | None implemented | Add append-only audit log table and middleware for administrative actions |
