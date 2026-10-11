import {
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomCodeSchema,
  type CreateRoomResponse,
} from '@scrim/protocol';
import type { Env } from './env.js';

export { Room } from './room.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health') return new Response('ok', { headers: cors });

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      if (!originAllowed(request, env))
        return new Response('Origin not allowed', { status: 403, headers: cors });
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = roomCode();
        const res = await stub(env, code).fetch('https://room/init', { method: 'POST' });
        if (res.status === 409) continue;
        if (!res.ok) return new Response('Could not create room', { status: 502, headers: cors });
        const keys = (await res.json()) as Omit<CreateRoomResponse, 'code'>;
        const body: CreateRoomResponse = { code, ...keys };
        return Response.json(body, { headers: cors });
      }
      return new Response('No free room code, try again', { status: 503, headers: cors });
    }

    // Keeping a code needs the room's host key: anyone may open a room, but only its host may
    // hold its code for months.
    const keep = /^\/api\/rooms\/([^/]+)\/keep$/.exec(url.pathname);
    if (keep && request.method === 'POST') {
      const code = keep[1]!.toUpperCase();
      if (!RoomCodeSchema.safeParse(code).success)
        return new Response('Bad room code', { status: 400, headers: cors });
      const res = await stub(env, code).fetch('https://room/keep', {
        method: 'POST',
        body: await request.text(),
      });
      return new Response(res.body, { status: res.status, headers: cors });
    }

    const match = /^\/api\/rooms\/([^/]+)(\/ws)?$/.exec(url.pathname);
    if (match) {
      const code = match[1]!.toUpperCase();
      if (!RoomCodeSchema.safeParse(code).success) {
        return new Response('Bad room code', { status: 400, headers: cors });
      }
      if (match[2]) {
        const inner = new URL(`https://room/ws${url.search}`);
        inner.searchParams.set('code', code);
        return stub(env, code).fetch(new Request(inner, request));
      }
      const res = await stub(env, code).fetch('https://room/info');
      return new Response(res.body, {
        status: res.status,
        headers: { ...cors, 'content-type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;

function stub(env: Env, code: string): DurableObjectStub {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

function roomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

function originAllowed(request: Request, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  if (allowed.includes('*')) return true;
  const origin = request.headers.get('Origin');
  // Browsers send Origin on a cross-site POST. The load test and other non-browser clients do not,
  // and a page cannot omit the header, so an absent Origin is not another website.
  if (!origin) return true;
  return allowed.includes(origin);
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': originAllowed(request, env) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}
