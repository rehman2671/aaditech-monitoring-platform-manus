import Fastify from 'fastify';
import jwt from '@fastify/jwt';

const server = Fastify({ logger: true });

server.register(jwt, {
  secret: process.env.JWT_ACCESS_SECRET || 'supersecret-dashboard-key',
});

server.get('/health', async () => {
  return { status: 'healthy', service: 'dashboard-api', timestamp: new Date().toISOString() };
});

server.get('/api/v1/dashboard/summary', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  return {
    total_endpoints: 5,
    online_endpoints: 3,
    offline_endpoints: 1,
    warning_endpoints: 1,
    active_alerts: 2,
    disk_critical_count: 1,
  };
});

server.get('/api/v1/endpoints', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  return [
    {
      id: 'ep-001-uuid',
      hostname: 'WS-CORP-EXEC01',
      serial_number: 'SN-9982-XCV7',
      os_version: 'Windows 11 Enterprise',
      status: 'online',
      last_seen_at: new Date().toISOString(),
    },
    {
      id: 'ep-002-uuid',
      hostname: 'WS-CORP-SQL04',
      serial_number: 'SN-4412-BB29',
      os_version: 'Windows Server 2022',
      status: 'warning',
      last_seen_at: new Date().toISOString(),
    }
  ];
});

server.get('/api/v1/endpoints/:id', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  const { id } = request.params as { id: string };
  return {
    id,
    hostname: id === 'ep-002-uuid' ? 'WS-CORP-SQL04' : 'WS-CORP-EXEC01',
    serial_number: 'SN-9982-XCV7',
    os_version: 'Windows Server 2022',
    os_build: '20348.2402',
    domain_or_workgroup: 'CORP.INTERNAL',
    agent_version: '2.4.1-lts',
    status: 'online',
    hardware: { cpu: 'Intel(R) Xeon(R) Gold 6330', ram_gb: 128, disks: [{ drive: 'C:', free_gb: 1200, total_gb: 4096 }] },
    last_seen_at: new Date().toISOString(),
  };
});

server.post('/api/v1/alerts/:id/acknowledge', async (request, reply) => {
  try {
    const user = await request.jwtVerify<{ role?: string }>();
    if (user?.role !== 'admin') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin role required to acknowledge system alerts' } });
    }
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  const { id } = request.params as { id: string };
  return { success: true, alert_id: id, acknowledged: true };
});

server.get('/api/v1/alerts', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  return [
    {
      id: 'alt-101',
      endpoint_id: 'ep-002-uuid',
      hostname: 'WS-CORP-SQL04',
      rule_name: 'Disk Space Low (< 10% Free)',
      severity: 'critical',
      message: 'Drive E: on WS-CORP-SQL04 has only 820 GB free out of 4096 GB (20%).',
      acknowledged: false,
      triggered_at: new Date().toISOString(),
    }
  ];
});

server.post('/api/v1/enrollment-tokens', async (request, reply) => {
  try {
    const user = await request.jwtVerify<{ role?: string }>();
    if (user?.role !== 'admin') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin role required to generate enrollment tokens' } });
    }
  } catch (err) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' } });
  }

  return {
    success: true,
    token: `sp_enrol_${crypto.randomUUID().replaceAll('-', '')}`,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
});

const start = async () => {
  try {
    await server.listen({ port: 3002, host: '0.0.0.0' });
    console.log('Dashboard API running on port 3002');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
