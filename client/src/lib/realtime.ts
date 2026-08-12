import type { RealtimeEvent } from '../types';

/** Precision Enterprise Glass: node-and-pulse transport motif for live state updates. */
export type RealtimeStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface RealtimeClientOptions {
  url: string;
  token: string;
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private options: RealtimeClientOptions;

  constructor(options: RealtimeClientOptions) {
    this.options = options;
  }

  connect() {
    this.options.onStatus?.('connecting');
    const separator = this.options.url.includes('?') ? '&' : '?';
    this.socket = new WebSocket(`${this.options.url}${separator}token=${encodeURIComponent(this.options.token)}`);
    this.socket.onopen = () => this.options.onStatus?.('open');
    this.socket.onclose = () => this.options.onStatus?.('closed');
    this.socket.onerror = () => this.options.onStatus?.('error');
    this.socket.onmessage = (message) => {
      try {
        this.options.onEvent(JSON.parse(message.data) as RealtimeEvent);
      } catch {
        this.options.onStatus?.('error');
      }
    };
  }

  sendRefreshRequest(endpointId: string, modules: string[]) {
    this.socket?.send(JSON.stringify({
      type: 'refresh_request',
      endpoint_id: endpointId,
      modules,
      request_id: crypto.randomUUID(),
    }));
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}
