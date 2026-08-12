import type { RealtimeEvent } from '@/types';

export type SseStatus = 'connecting' | 'open' | 'closed' | 'error';

export class SseRealtimeClient {
  private source: EventSource | null = null;
  constructor(private readonly options: { url: string; onEvent: (event: RealtimeEvent) => void; onStatus?: (status: SseStatus) => void }) {}

  connect() {
    this.options.onStatus?.('connecting');
    this.source = new EventSource(this.options.url);
    this.source.onopen = () => this.options.onStatus?.('open');
    this.source.onerror = () => this.options.onStatus?.('error');
    this.source.onmessage = event => {
      try {
        this.options.onEvent(JSON.parse(event.data) as RealtimeEvent);
      } catch {
        this.options.onStatus?.('error');
      }
    };
  }

  close() {
    this.source?.close();
    this.source = null;
    this.options.onStatus?.('closed');
  }
}
