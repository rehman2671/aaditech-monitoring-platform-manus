import Fastify from 'fastify';
import crypto from 'crypto';

const fastify = Fastify({ logger: true });

// In-memory idempotency cache (simulating Redis cluster)
const idempotencyStore = new Set<string>();
const deadLetterQueue: Array<{ id: string; payload: any; error: string; timestamp: string }> = [];

fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    service: 'ingestion-api', 
    dlqSize: deadLetterQueue.length,
    timestamp: new Date().toISOString() 
  });
});

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 200): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

fastify.post('/api/v1/telemetry', {
  schema: {
    body: {
      type: 'object',
      required: ['endpoint_id', 'module', 'payload'],
      properties: {
        endpoint_id: { type: 'string' },
        module: { type: 'string' },
        payload: { type: 'object' },
        captured_at: { type: 'string', format: 'date-time' }
      }
    }
  }
}, async (request, reply) => {
  const idempotencyKey = request.headers['x-idempotency-key'] as string;
  const body = request.body as any;

  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    return reply.code(200).send({ success: true, queued: true, note: 'idempotent_duplicate_filtered' });
  }

  if (idempotencyKey) {
    idempotencyStore.add(idempotencyKey);
  }

  const requestId = crypto.randomUUID();

  try {
    await retryWithBackoff(async () => {
      // Simulate durable Redis Stream queue insertion or TimescaleDB write
      const success = Math.random() > 0.05; // 95% success rate to test retry
      if (!success) throw new Error('Transient database lock or network timeout');
      return true;
    }, 3, 100);

    return reply.code(202).send({
      success: true,
      queued: true,
      request_id: requestId,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    fastify.log.error(`[Ingestion DLQ] Failed after retries for endpoint ${body.endpoint_id}: ${err.message}`);
    deadLetterQueue.push({
      id: requestId,
      payload: body,
      error: err.message,
      timestamp: new Date().toISOString()
    });

    return reply.code(503).send({
      error: {
        code: 'SERVICE_UNAVAILABLE_BUFFER_LOCAL',
        message: 'Ingestion pipeline temporarily congested. Payload buffered to agent local SQLite.',
        request_id: requestId
      }
    });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Hardened Ingestion API listening on port 4000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
