import { wsUrl } from '../lib/config.js';

export type RelayStatus = 'connecting' | 'open' | 'closed' | 'failed';

export interface RelayOptions {
  relay: string;
  code: string;
  role: 'host' | 'output' | 'remote' | 'audience';
  key?: string;
  client: string;
  /** Close codes that mean "stop retrying". */
  fatal?: number[];
}

/**
 * WebSocket to a relay room with automatic reconnect and server-clock
 * estimation (`offset` = server time - local time, from the lowest-RTT ping).
 */
export class RelayClient<In extends { t: string }, Out extends { t: string }> {
  status: RelayStatus = 'connecting';
  offset = 0;
  rtt = Infinity;
  lastClose: { code: number; reason: string } | null = null;
  #ws: WebSocket | null = null;
  #retry = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #ping: ReturnType<typeof setInterval> | null = null;
  #samples: { rtt: number; offset: number }[] = [];
  #closed = false;
  #onMessage = new Set<(msg: In) => void>();
  #onStatus = new Set<(s: RelayStatus) => void>();

  constructor(private readonly opts: RelayOptions) {
    this.#connect();
  }

  send(msg: Out): boolean {
    if (this.#ws?.readyState !== WebSocket.OPEN) return false;
    this.#ws.send(JSON.stringify(msg));
    return true;
  }

  onMessage(l: (msg: In) => void): () => void {
    this.#onMessage.add(l);
    return () => this.#onMessage.delete(l);
  }

  onStatus(l: (s: RelayStatus) => void): () => void {
    this.#onStatus.add(l);
    return () => this.#onStatus.delete(l);
  }

  /** Local time to server time. */
  serverNow(local = Date.now()): number {
    return local + this.offset;
  }

  close(): void {
    this.#closed = true;
    if (this.#timer) clearTimeout(this.#timer);
    if (this.#ping) clearInterval(this.#ping);
    this.#ws?.close(1000, 'bye');
    this.#setStatus('closed');
  }

  #connect(): void {
    const { relay, code, role, key, client } = this.opts;
    const params = new URLSearchParams({ role, client });
    if (key) params.set('key', key);
    this.#setStatus('connecting');
    const ws = new WebSocket(wsUrl(relay, `/api/rooms/${encodeURIComponent(code)}/ws?${params}`));
    this.#ws = ws;
    ws.onopen = () => {
      this.#retry = 0;
      this.#setStatus('open');
      this.#sendPing();
      if (this.#ping) clearInterval(this.#ping);
      this.#ping = setInterval(() => this.#sendPing(), 3000);
    };
    ws.onmessage = (e) => {
      let msg: In & { c?: number; s?: number };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.t === 'pong' && typeof msg.c === 'number' && typeof msg.s === 'number') {
        this.#pong(msg.c, msg.s);
        return;
      }
      for (const l of this.#onMessage) l(msg);
    };
    ws.onclose = (e) => {
      if (this.#ping) clearInterval(this.#ping);
      if (this.#ws !== ws) return;
      this.lastClose = { code: e.code, reason: e.reason };
      if (this.#closed) return;
      if (this.opts.fatal?.includes(e.code)) {
        this.#setStatus('failed');
        return;
      }
      this.#setStatus('connecting');
      const delay = Math.min(5000, 300 * 2 ** this.#retry++) * (0.75 + Math.random() * 0.5);
      this.#timer = setTimeout(() => this.#connect(), delay);
    };
  }

  #sendPing(): void {
    if (this.#ws?.readyState === WebSocket.OPEN)
      this.#ws.send(JSON.stringify({ t: 'ping', c: Date.now() }));
  }

  #pong(sent: number, server: number): void {
    const now = Date.now();
    const rtt = now - sent;
    this.#samples.push({ rtt, offset: server - (sent + rtt / 2) });
    if (this.#samples.length > 10) this.#samples.shift();
    const best = this.#samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = best.rtt;
  }

  #setStatus(s: RelayStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const l of this.#onStatus) l(s);
  }
}
