import { EventEmitter } from 'events';

class RealtimeHub extends EventEmitter {
  private clients = new Set<any>();

  public addClient(reply: any) {
    this.clients.add(reply);
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    reply.raw.on('close', () => {
      this.clients.delete(reply);
    });
  }

  public broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.raw.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}

export const realtimeHub = new RealtimeHub();
