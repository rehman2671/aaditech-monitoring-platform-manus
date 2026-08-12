import fs from 'node:fs/promises';
import path from 'node:path';

export type TelemetryEnvelope = {
  endpoint_id: string;
  module: string;
  payload: Record<string, unknown>;
  captured_at?: string;
  schema_version?: string;
  sequence_number?: number;
};

type QueueItem = {
  requestId: string;
  idempotencyKey: string;
  envelope: TelemetryEnvelope;
  attempts: number;
  nextAttemptAt: string;
  status: 'queued' | 'processed' | 'dead_letter';
  lastError?: string;
  createdAt: string;
};

type DurableState = {
  idempotency: Record<string, { requestId: string; status: QueueItem['status']; expiresAt: string }>;
  queue: QueueItem[];
  heartbeats: Record<string, { lastSeenAt: string; status: 'online' | 'stale' }>;
  deadLetters: QueueItem[];
};

const emptyState = (): DurableState => ({ idempotency: {}, queue: [], heartbeats: {}, deadLetters: [] });

export class DurableIngestionStore {
  private state: DurableState = emptyState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = process.env.INGESTION_STATE_FILE ?? path.join(process.cwd(), 'data', 'ingestion-state.json')) {}

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.state = { ...emptyState(), ...JSON.parse(raw) } as DurableState;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.persist();
    }
    this.loaded = true;
  }

  private async persist() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await fs.rename(tempPath, this.filePath);
  }

  private async mutate<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.load();
    let result!: T;
    this.writeChain = this.writeChain.then(async () => {
      result = await fn();
      await this.persist();
    });
    await this.writeChain;
    return result;
  }

  async getIdempotency(key: string) {
    await this.load();
    const record = this.state.idempotency[key];
    if (!record) return undefined;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await this.mutate(() => { delete this.state.idempotency[key]; });
      return undefined;
    }
    return record;
  }

  async enqueue(requestId: string, idempotencyKey: string, envelope: TelemetryEnvelope) {
    return this.mutate(() => {
      const item: QueueItem = {
        requestId,
        idempotencyKey,
        envelope,
        attempts: 0,
        nextAttemptAt: new Date().toISOString(),
        status: 'queued',
        createdAt: new Date().toISOString(),
      };
      this.state.queue.push(item);
      this.state.idempotency[idempotencyKey] = { requestId, status: 'queued', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
      return item;
    });
  }

  async claimReady(limit = 50) {
    await this.load();
    return this.state.queue.filter(item => item.status === 'queued' && Date.parse(item.nextAttemptAt) <= Date.now()).slice(0, limit);
  }

  async markProcessed(requestId: string) {
    await this.mutate(() => {
      const item = this.state.queue.find(entry => entry.requestId === requestId);
      if (!item) return;
      item.status = 'processed';
      const record = this.state.idempotency[item.idempotencyKey];
      if (record) record.status = 'processed';
    });
  }

  async retryOrDeadLetter(requestId: string, error: string, maxAttempts = 5) {
    return this.mutate(() => {
      const item = this.state.queue.find(entry => entry.requestId === requestId);
      if (!item) return 'missing' as const;
      item.attempts += 1;
      item.lastError = error;
      if (item.attempts >= maxAttempts) {
        item.status = 'dead_letter';
        this.state.deadLetters.push({ ...item });
        const record = this.state.idempotency[item.idempotencyKey];
        if (record) record.status = 'dead_letter';
        return 'dead_letter' as const;
      }
      const delayMs = Math.min(60_000, 500 * 2 ** (item.attempts - 1)) + Math.floor(Math.random() * 100);
      item.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      return 'retry' as const;
    });
  }

  async recordHeartbeat(endpointId: string, lastSeenAt = new Date()) {
    await this.mutate(() => {
      this.state.heartbeats[endpointId] = { lastSeenAt: lastSeenAt.toISOString(), status: 'online' };
    });
  }

  async markStale(thresholdMs = 15 * 60 * 1000) {
    return this.mutate(() => Object.entries(this.state.heartbeats).filter(([, value]) => {
      const stale = Date.parse(value.lastSeenAt) < Date.now() - thresholdMs;
      if (stale) value.status = 'stale';
      return stale;
    }).map(([endpointId, value]) => ({ endpointId, ...value })));
  }

  async snapshot() {
    await this.load();
    return JSON.parse(JSON.stringify(this.state)) as DurableState;
  }
}
