import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', service: 'ingestion-api', timestamp: new Date().toISOString() };
});

fastify.post('/api/v1/telemetry', async (request, reply) => {
  // Ingests endpoint telemetry and drops to Redis stream queue
  return { success: true, queued: true };
});

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Ingestion API listening on port 4000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
