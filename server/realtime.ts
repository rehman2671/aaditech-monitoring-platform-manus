import type { Express, Request, Response } from 'express';
import type { RealtimeEvent } from '../client/src/types';
import { sdk } from './_core/sdk';

interface RealtimeClient {
  response: Response;
  organizationId: string;
}

const clients = new Set<RealtimeClient>();

export function registerRealtimeRoutes(app: Express) {
  app.get('/api/realtime/stream', async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const organizationId = String((user as typeof user & { organizationId?: string }).organizationId ?? user.openId);

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

      const client = { response: res, organizationId };
      clients.add(client);

      req.on('close', () => {
        clients.delete(client);
        res.end();
      });
    } catch {
      if (!res.headersSent) res.status(401).json({ error: 'Authentication required' });
      else res.end();
    }
  });
}

export function broadcastRealtimeEvent(event: RealtimeEvent) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  clients.forEach(client => {
    const eventOrganizationId = 'organizationId' in event && typeof event.organizationId === 'string' ? event.organizationId : undefined;
    if (eventOrganizationId && eventOrganizationId !== client.organizationId) return;
    try {
      client.response.write(payload);
    } catch {
      clients.delete(client);
    }
  });
}
