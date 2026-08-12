import Fastify, { type FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DurableIngestionStore, type TelemetryEnvelope } from './durableStore.js';
import { evaluateRules, type AlertRule } from './alertEvaluator.js';

export function buildIngestionServer(options: { store?: DurableIngestionStore } = {}) {
  const fastify = Fastify({ logger: true });
  const store = options.store ?? new DurableIngestionStore();
  let processing = false;

  fastify.get('/health', async () => {
    const snapshot = await store.snapshot();
    return {
      status: 'ok',
      service: 'ingestion-api',
      queued: snapshot.queue.filter(item => item.status === 'queued').length,
      processed: snapshot.queue.filter(item => item.status === 'processed').length,
      dlqSize: snapshot.deadLetters.length,
      staleEndpoints: Object.values(snapshot.heartbeats).filter(item => item.status === 'stale').length,
      timestamp: new Date().toISOString(),
    };
  });

  fastify.post('/api/v1/telemetry', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-idempotency-key'],
        properties: { 'x-idempotency-key': { type: 'string', minLength: 8, maxLength: 200 } },
      },
      body: {
        type: 'object',
        required: ['endpoint_id', 'module', 'payload'],
        properties: {
          endpoint_id: { type: 'string', minLength: 1, maxLength: 128 },
          module: { type: 'string', minLength: 1, maxLength: 64 },
          payload: { type: 'object' },
          captured_at: { type: 'string', format: 'date-time' },
          schema_version: { type: 'string', maxLength: 32 },
          sequence_number: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const idempotencyKey = request.headers['x-idempotency-key'];
    const envelope = request.body as TelemetryEnvelope;
    const existing = await store.getIdempotency(idempotencyKey);
    if (existing) {
      return reply.code(200).send({ success: true, queued: existing.status === 'queued', duplicate: true, request_id: existing.requestId });
    }

    const requestId = crypto.randomUUID();
    await store.enqueue(requestId, idempotencyKey, envelope);
    await store.recordHeartbeat(envelope.endpoint_id);
    return reply.code(202).send({ success: true, queued: true, duplicate: false, request_id: requestId, timestamp: new Date().toISOString() });
  });

  fastify.get('/api/v1/heartbeats/stale', async (request) => {
    const query = request.query as { threshold_minutes?: string };
    return { endpoints: await store.markStale(Math.max(1, Number(query.threshold_minutes ?? 15)) * 60 * 1000) };
  });

  const configuredRules: AlertRule[] = (() => {
    try {
      return JSON.parse(process.env.ALERT_RULES_JSON ?? '[]') as AlertRule[];
    } catch {
      fastify.log.warn('ALERT_RULES_JSON is invalid; starting with no alert rules');
      return [];
    }
  })();

  async function persistEnvelope(envelope: TelemetryEnvelope) {
    const ledgerPath = process.env.TELEMETRY_LEDGER_FILE ?? path.join(process.cwd(), 'data', 'telemetry-ledger.jsonl');
    await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
    await fs.appendFile(ledgerPath, `${JSON.stringify({ ...envelope, persisted_at: new Date().toISOString() })}\n`, { mode: 0o600 });
    const payload = envelope.payload as Record<string, unknown>;
    const numericValues = Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value === 'number')) as Record<string, number>;
    const alertEvents = evaluateRules(envelope.endpoint_id, numericValues, configuredRules);
    if (alertEvents.length) {
      const alertLedger = process.env.ALERT_LEDGER_FILE ?? path.join(process.cwd(), 'data', 'alert-events.jsonl');
      await fs.mkdir(path.dirname(alertLedger), { recursive: true });
      await fs.appendFile(alertLedger, alertEvents.map(event => JSON.stringify(event)).join('\n') + '\n', { mode: 0o600 });
    }
  }

  async function processQueue() {
    if (processing) return;
    processing = true;
    try {
      const items = await store.claimReady(50);
      for (const item of items) {
        try {
          await persistEnvelope(item.envelope);
          await store.markProcessed(item.requestId);
        } catch (error: any) {
          await store.retryOrDeadLetter(item.requestId, error?.message ?? 'telemetry persistence failed');
          fastify.log.error({ requestId: item.requestId, error }, 'Telemetry processing failed');
        }
      }
    } finally {
      processing = false;
    }
  }

  const processTimer = setInterval(() => void processQueue(), 1000);
  processTimer.unref?.();

  return { fastify, store, processQueue, close: () => fastify.close() };
}

export async function start() {
  const { fastify } = buildIngestionServer();
  try {
    await fastify.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? '0.0.0.0' });
    fastify.log.info('Durable Ingestion API listening');
  } catch (error) {
    fastify.log.error(error);
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) void start();
