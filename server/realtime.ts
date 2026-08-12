import type { Express, Request, Response } from 'express';
import type { RealtimeEvent } from '../client/src/types';

const clients = new Set<Response>();

export function registerRealtimeRoutes(app: Express) {
  app.get('/api/realtime/stream', (req: Request, res: Response) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
    clients.add(res);

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
      res.end();
    });
  });
}

export function broadcastRealtimeEvent(event: RealtimeEvent) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  });
}
