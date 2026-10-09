import { DurableObject } from 'cloudflare:workers';
import type { Show } from '@scrim/format';
import {
  AudienceToRelaySchema,
  CLOSE,
  OutputToRelaySchema,
  RemoteToRelaySchema,
  type CreateRoomResponse,
  type HostToRelay,
  type AccessView,
  type Presence,
  type RelayToAudience,
  type RelayToHost,
  type RelayToOutput,
  type RelayToRemote,
  type RemoteView,
  type Role,
} from '@scrim/protocol';
import { Aggregator, type AggregatorSnapshot } from './aggregate.js';
import type { Env } from './env.js';
import { codeInUse, expiryDecision, IDLE_EXPIRY_MS, type RoomLife } from './expiry.js';

interface Attachment {
  role: Role;
  client: string;
  /** An audience socket for a shared tablet: its answers count per ballot. */
  shared?: boolean;
}

interface Keys extends RoomLife {
  hostKey: string;
  deviceKey: string;
  /** Absent in rooms made before shared tablets. */
  sharedKey?: string;
}

type StateMsg = Extract<HostToRelay, { t: 'state' }>;

const ROLES: Role[] = ['host', 'output', 'remote', 'audience'];
const FLUSH_MS = 200;
const STATE_PERSIST_MS = 2000;
const MAX_HOST_MESSAGE = 4 * 1024 * 1024;
const MAX_CLIENT_MESSAGE = 4 * 1024;
const MAX_MESSAGES_PER_SECOND = 30;

/**
 * One room per running show. The host (the operator's browser) is the source
 * of truth; the room fans its state out to remote outputs and remotes, and
 * folds audience input into totals for the host.
 */
export class Room extends DurableObject<Env> {
  #keys: Keys | null = null;
  #agg = new Aggregator();
  #show: Show | null = null;
  #state: StateMsg | null = null;
  #remoteView: Omit<RemoteView, 'connected'> | null = null;
  #access: AccessView | null = null;
  #flushTimer: ReturnType<typeof setTimeout> | null = null;
  #statePersistedAt = 0;
  #rates = new Map<string, { n: number; second: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<unknown>([
        'keys',
        'agg',
        'show',
        'state',
        'remoteView',
        'access',
      ]);
      this.#keys = (stored.get('keys') as Keys | undefined) ?? null;
      const agg = stored.get('agg') as AggregatorSnapshot | undefined;
      if (agg) this.#agg = new Aggregator(agg);
      this.#show = (stored.get('show') as Show | undefined) ?? null;
      this.#state = (stored.get('state') as StateMsg | undefined) ?? null;
      this.#remoteView = (stored.get('remoteView') as RemoteView | undefined) ?? null;
      this.#access = (stored.get('access') as AccessView | undefined) ?? null;
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') return this.#init();
    if (url.pathname === '/keep' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        hostKey?: unknown;
        keep?: unknown;
      };
      if (!this.#keys) return new Response('No such room', { status: 404 });
      if (body.hostKey !== this.#keys.hostKey)
        return new Response('Wrong host key', { status: 401 });
      this.#keep(body.keep === true);
      return Response.json({ keep: body.keep === true });
    }
    if (url.pathname === '/info') {
      return Response.json({
        exists: !!this.#keys,
        title: this.#agg.title || this.#show?.name || '',
      });
    }
    if (url.pathname === '/ws') return this.#accept(url, request);
    return new Response('Not found', { status: 404 });
  }

  async #init(): Promise<Response> {
    if (codeInUse(this.#keys, Date.now(), this.ctx.getWebSockets().length)) {
      return new Response('Room code in use', { status: 409 });
    }
    await this.ctx.storage.deleteAll();
    this.#agg = new Aggregator();
    this.#show = null;
    this.#state = null;
    this.#remoteView = null;
    this.#access = null;
    this.#keys = {
      hostKey: secret(),
      deviceKey: secret(),
      sharedKey: secret(),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    await this.ctx.storage.put('keys', this.#keys);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);
    const body: Omit<CreateRoomResponse, 'code'> = {
      hostKey: this.#keys.hostKey,
      deviceKey: this.#keys.deviceKey,
      sharedKey: this.#keys.sharedKey!,
    };
    return Response.json(body);
  }

  #accept(url: URL, request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    const role = url.searchParams.get('role') as Role;
    const key = url.searchParams.get('key') ?? '';
    let client = url.searchParams.get('client') ?? '';
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(client)) client = secret().slice(0, 16);

    const pair = new WebSocketPair();
    const [clientEnd, server] = [pair[0], pair[1]];
    const reject = (code: number, reason: string) => {
      this.ctx.acceptWebSocket(server, ['rejected']);
      server.close(code, reason);
      return new Response(null, { status: 101, webSocket: clientEnd });
    };
    if (!ROLES.includes(role)) return reject(CLOSE.badRequest, 'Unknown role');
    if (!this.#keys) return reject(CLOSE.notFound, 'No such room');
    if (role === 'host' && key !== this.#keys.hostKey)
      return reject(CLOSE.unauthorized, 'Wrong host key');
    if ((role === 'output' || role === 'remote') && key !== this.#keys.deviceKey) {
      return reject(CLOSE.unauthorized, 'Wrong device key');
    }
    if (
      role === 'audience' &&
      this.ctx.getWebSockets('audience').length >= Number(this.env.MAX_AUDIENCE)
    ) {
      return reject(CLOSE.full, 'This room is full');
    }
    if (role === 'host') {
      for (const ws of this.ctx.getWebSockets('host'))
        ws.close(CLOSE.replaced, 'Another operator took over');
    }

    const shared = role === 'audience' && !!this.#keys.sharedKey && key === this.#keys.sharedKey;
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({
      role,
      client,
      ...(shared ? { shared } : {}),
    } satisfies Attachment);
    void this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);
    this.#seen();

    switch (role) {
      case 'host':
        send<RelayToHost>(server, {
          t: 'welcome',
          role: 'host',
          code: url.searchParams.get('code') ?? '',
        });
        send<RelayToHost>(server, { t: 'totals', totals: this.#agg.takeTotals(true) });
        break;
      case 'output':
        send<RelayToOutput>(server, { t: 'welcome', role: 'output' });
        if (this.#show) send<RelayToOutput>(server, { t: 'show', show: this.#show });
        if (this.#state) send<RelayToOutput>(server, this.#state);
        break;
      case 'remote':
        send<RelayToRemote>(server, { t: 'welcome', role: 'remote' });
        if (this.#remoteView)
          send<RelayToRemote>(server, { t: 'remoteView', view: this.#viewForRemote() });
        break;
      case 'audience':
        send<RelayToAudience>(server, { t: 'welcome', role: 'audience', title: this.#agg.title });
        this.#sendAudienceView(server, client);
        // A phone that joins late, or reloads, catches up with the caption and the warning.
        if (this.#access) send<RelayToAudience>(server, { t: 'access', view: this.#access });
        break;
    }
    // A socket accepted in this call is not yet listed by getWebSockets in every runtime.
    this.#broadcastPresence(role === 'host' ? server : null);
    if (role === 'host') this.#broadcastRemoteView(true);
    return new Response(null, { status: 101, webSocket: clientEnd });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || typeof raw !== 'string') return;
    const limit = att.role === 'host' ? MAX_HOST_MESSAGE : MAX_CLIENT_MESSAGE;
    if (raw.length > limit) return;
    if (att.role !== 'host' && !this.#allow(att.client)) return;
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (att.role) {
      case 'host':
        return this.#fromHost(ws, msg as HostToRelay);
      case 'audience': {
        const parsed = AudienceToRelaySchema.safeParse(msg);
        if (!parsed.success) return;
        if (parsed.data.t === 'ping')
          return send(ws, { t: 'pong', c: parsed.data.c, s: Date.now() });
        // A ballot counts only from a shared tablet; a phone's own answers are one person.
        const ballot = att.shared && 'ballot' in parsed.data ? parsed.data.ballot : undefined;
        if (this.#agg.input(att.client, parsed.data, Date.now(), ballot)) this.#scheduleFlush();
        return;
      }
      case 'remote': {
        const parsed = RemoteToRelaySchema.safeParse(msg);
        if (!parsed.success) return;
        if (parsed.data.t === 'ping')
          return send(ws, { t: 'pong', c: parsed.data.c, s: Date.now() });
        const host = this.ctx.getWebSockets('host')[0];
        if (!host)
          return send<RelayToRemote>(ws, { t: 'error', message: 'The show is not connected' });
        // GO, Hold and Back from a remote: the host decides whether the show allows them.
        if (parsed.data.t === 'command')
          return send<RelayToHost>(host, {
            t: 'command',
            command: parsed.data.command,
            from: att.client,
          });
        // Ready is acknowledged by the host's next remote view, once the operator has it.
        if (parsed.data.t === 'ready')
          return send<RelayToHost>(host, {
            t: 'ready',
            cueId: parsed.data.cueId,
            from: att.client,
          });
        send<RelayToHost>(host, {
          t: 'trigger',
          triggerId: parsed.data.triggerId,
          from: att.client,
        });
        send<RelayToRemote>(ws, { t: 'ack', triggerId: parsed.data.triggerId });
        return;
      }
      case 'output': {
        const parsed = OutputToRelaySchema.safeParse(msg);
        if (!parsed.success) return;
        if (parsed.data.t === 'ping')
          return send(ws, { t: 'pong', c: parsed.data.c, s: Date.now() });
        for (const host of this.ctx.getWebSockets('host')) {
          send<RelayToHost>(host, {
            t: 'outputBeat',
            clientId: att.client,
            outputId: parsed.data.outputId,
            status: parsed.data.status,
          });
        }
        return;
      }
    }
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    try {
      ws.close(code === 1005 ? 1000 : code, 'closing');
    } catch {
      // already closed
    }
    if (!att) return;
    this.#rates.delete(att.client);
    if (att.role === 'host') {
      if (!this.ctx.getWebSockets('host').some((s) => s !== ws)) {
        for (const o of this.ctx.getWebSockets('output')) send<RelayToOutput>(o, { t: 'hostGone' });
        this.#broadcastRemoteView(false);
      }
    }
    if (att.role === 'output') {
      for (const host of this.ctx.getWebSockets('host'))
        send<RelayToHost>(host, { t: 'outputGone', clientId: att.client });
    }
    this.#broadcastPresence(null, ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }

  override async alarm(): Promise<void> {
    if (!this.#keys) return;
    const connected = this.ctx.getWebSockets().length;
    if (connected) this.#seen();
    const { action, next } = expiryDecision(this.#keys, Date.now(), connected);
    if (action === 'delete') {
      await this.ctx.storage.deleteAll();
      this.#keys = null;
      return;
    }
    if (action === 'clear') {
      // A kept room's code waits for the next visitor; the last show's votes and state don't.
      await this.ctx.storage.delete(['agg', 'show', 'state', 'remoteView', 'access']);
      this.#agg = new Aggregator();
      this.#show = null;
      this.#state = null;
      this.#remoteView = null;
      this.#access = null;
    }
    if (next) await this.ctx.storage.setAlarm(next);
  }

  /** Keep this code for an installation's printed QR codes, or let it go back to a day. */
  #keep(keep: boolean): void {
    if (!this.#keys) return;
    this.#keys = { ...this.#keys, lastSeenAt: Date.now() };
    if (keep) this.#keys.keep = true;
    else delete this.#keys.keep;
    void this.ctx.storage.put('keys', this.#keys);
  }

  /** Note that the room is in use now, for its expiry. */
  #seen(): void {
    if (!this.#keys) return;
    this.#keys = { ...this.#keys, lastSeenAt: Date.now() };
    void this.ctx.storage.put('keys', this.#keys);
  }

  #fromHost(ws: WebSocket, msg: HostToRelay): void {
    switch (msg.t) {
      case 'ping':
        return send<RelayToHost>(ws, { t: 'pong', c: msg.c, s: Date.now() });
      case 'show':
        this.#show = msg.show;
        void this.ctx.storage.put('show', msg.show);
        for (const o of this.ctx.getWebSockets('output')) send<RelayToOutput>(o, msg);
        return;
      case 'state': {
        this.#state = msg;
        const now = Date.now();
        if (now - this.#statePersistedAt > STATE_PERSIST_MS) {
          this.#statePersistedAt = now;
          void this.ctx.storage.put('state', msg);
        }
        const text = JSON.stringify(msg);
        for (const o of this.ctx.getWebSockets('output')) safeSend(o, text);
        return;
      }
      case 'moments':
        if (this.#agg.setOpen(msg.title, msg.open)) {
          for (const a of this.ctx.getWebSockets('audience')) {
            const att = a.deserializeAttachment() as Attachment | null;
            if (att) this.#sendAudienceView(a, att.client);
          }
        }
        this.#scheduleFlush();
        return;
      case 'keep':
        this.#keep(msg.keep);
        return;
      case 'remoteView':
        this.#remoteView = msg.view;
        void this.ctx.storage.put('remoteView', msg.view);
        this.#broadcastRemoteView(true);
        return;
      case 'access': {
        this.#access = msg.view;
        void this.ctx.storage.put('access', msg.view);
        const text = JSON.stringify({ t: 'access', view: msg.view } satisfies RelayToAudience);
        for (const a of this.ctx.getWebSockets('audience')) safeSend(a, text);
        return;
      }
    }
  }

  #viewForRemote(connected = this.ctx.getWebSockets('host').length > 0): RemoteView {
    return {
      showName: '',
      triggers: [],
      standby: null,
      lastFired: null,
      ...this.#remoteView,
      connected,
    };
  }

  #broadcastRemoteView(connected: boolean): void {
    if (!this.#remoteView) return;
    const text = JSON.stringify({
      t: 'remoteView',
      view: this.#viewForRemote(connected),
    } satisfies RelayToRemote);
    for (const r of this.ctx.getWebSockets('remote')) safeSend(r, text);
  }

  #sendAudienceView(ws: WebSocket, client: string): void {
    send<RelayToAudience>(ws, {
      t: 'view',
      title: this.#agg.title,
      moments: this.#agg.publicView(client),
      mine: {},
    });
  }

  #broadcastPresence(extraHost: WebSocket | null, leaving?: WebSocket): void {
    const count = (role: Role) => this.ctx.getWebSockets(role).filter((s) => s !== leaving).length;
    const presence: Presence = {
      audience: count('audience'),
      remotes: count('remote'),
      outputs: count('output'),
    };
    const hosts = new Set(this.ctx.getWebSockets('host'));
    if (extraHost) hosts.add(extraHost);
    for (const h of hosts) if (h !== leaving) send<RelayToHost>(h, { t: 'presence', presence });
  }

  #scheduleFlush(): void {
    if (this.#flushTimer) return;
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      if (!this.#agg.dirty) return;
      const totals = this.#agg.takeTotals();
      void this.ctx.storage.put('agg', this.#agg.snapshot());
      for (const h of this.ctx.getWebSockets('host')) send<RelayToHost>(h, { t: 'totals', totals });
    }, FLUSH_MS);
  }

  #allow(client: string): boolean {
    const second = Math.floor(Date.now() / 1000);
    const r = this.#rates.get(client);
    if (!r || r.second !== second) {
      this.#rates.set(client, { n: 1, second });
      return true;
    }
    r.n += 1;
    return r.n <= MAX_MESSAGES_PER_SECOND;
  }
}

function send<T>(ws: WebSocket, msg: T): void {
  safeSend(ws, JSON.stringify(msg));
}

function safeSend(ws: WebSocket, text: string): void {
  try {
    ws.send(text);
  } catch {
    // socket closing; the close handler cleans up
  }
}

function secret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) =>
    c === '+' ? '-' : c === '/' ? '_' : '',
  );
}
