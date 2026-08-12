# SentinelPulse Final Delivery Todo

## Phase 1 & 2: Audit & Design
- [x] Re-audit requirements: versioned MSI builder/downloader, retry/idempotent ingestion, CSV/PDF reports, real-time metrics feed, and reusable skill.
- [ ] Document design specifications for versioned MSI bundles and export endpoints.

## Phase 3: Versioned MSI Build & Download Pipeline
- [ ] Implement backend procedure/endpoint for building and downloading versioned agent MSI installers (`v2.4.1`, `v2.5.0`, etc.).
- [ ] Add UI controls in the Enrollment / Agent Deploy page to select version, generate/compile MSI package, and download the binary artifact.

## Phase 4: Hardened Ingestion API (Retries & Idempotency)
- [ ] Implement robust retry, exponential backoff, and idempotency key deduplication in ingestion handlers.
- [ ] Add dead-letter queue and error observability logging for interrupted streams.

## Phase 5: CSV/PDF Reports & Real-Time Agent Metrics Dashboard
- [ ] Add CSV and formatted PDF report export functionality for fleet telemetry and active alerts.
- [ ] Wire real-time WebSocket / SSE telemetry stream into the frontend dashboard for live CPU/RAM/process updates.

## Phase 6: Reusable Skill Creation (`skill-creator`)
- [x] Create a new reusable skill (`sentinelpulse-delivery`) using `skill-creator` instructions for end-to-end monitoring platforms and MSI packaging.

## Phase 7: Validation, Checkpoint & Delivery
- [ ] Run TypeScript check, Vitest, build test, and visual verification.
- [ ] Save final checkpoint and deliver complete results.
