import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DurableIngestionStore } from '../backend/services/ingestion-api/durableStore';

describe('DurableIngestionStore', () => {
  it('persists idempotency and survives a new store instance', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sentinelpulse-ingestion-'));
    const filePath = path.join(directory, 'state.json');
    const first = new DurableIngestionStore(filePath);
    await first.enqueue('req-1', 'idem-12345678', { endpoint_id: 'ep-1', module: 'cpu', payload: { utilization: 23 } });

    const second = new DurableIngestionStore(filePath);
    const duplicate = await second.getIdempotency('idem-12345678');
    expect(duplicate?.requestId).toBe('req-1');
    expect((await second.claimReady()).map(item => item.requestId)).toEqual(['req-1']);
  });

  it('moves an item to dead-letter after max attempts', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sentinelpulse-dlq-'));
    const store = new DurableIngestionStore(path.join(directory, 'state.json'));
    await store.enqueue('req-2', 'idem-dead-123', { endpoint_id: 'ep-2', module: 'network', payload: {} });
    expect(await store.retryOrDeadLetter('req-2', 'timeout', 1)).toBe('dead_letter');
    const snapshot = await store.snapshot();
    expect(snapshot.deadLetters).toHaveLength(1);
    expect(snapshot.idempotency['idem-dead-123']?.status).toBe('dead_letter');
  });

  it('marks stale heartbeats without deleting endpoint state', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sentinelpulse-heartbeat-'));
    const store = new DurableIngestionStore(path.join(directory, 'state.json'));
    await store.recordHeartbeat('ep-3', new Date(Date.now() - 60_000));
    const stale = await store.markStale(10_000);
    expect(stale.map(item => item.endpointId)).toContain('ep-3');
    expect((await store.snapshot()).heartbeats['ep-3']?.status).toBe('stale');
  });
});
