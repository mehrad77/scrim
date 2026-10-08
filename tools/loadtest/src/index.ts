// Simulated audience load test for the relay.
// Usage: pnpm loadtest -- --relay http://localhost:8790 --phones 200 --rounds 3
// Opens a room as the host, joins N phones, runs vote rounds and reports the
// time from a phone's vote to the host seeing it in the totals.

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]!;
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1] ?? '');
}
const relay = (args.get('relay') ?? process.env.RELAY_URL ?? 'http://localhost:8790').replace(
  /\/$/,
  '',
);
const phones = Number(args.get('phones') ?? 200);
const rounds = Number(args.get('rounds') ?? 3);
const wsBase = relay.replace(/^http/, 'ws');

function open(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`could not connect ${url}`));
  });
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? NaN;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${relay}/api/rooms`, { method: 'POST' });
if (!res.ok) throw new Error(`create room: ${res.status}`);
const room = (await res.json()) as { code: string; hostKey: string };
console.log(`room ${room.code}: connecting host and ${phones} phones…`);

const host = await open(
  `${wsBase}/api/rooms/${room.code}/ws?role=host&key=${room.hostKey}&client=loadtesthost`,
);
let seen = 0;
let joined = 0;
let onTotals: ((n: number, at: number) => void) | null = null;
host.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.t === 'totals') {
    for (const t of msg.totals) {
      if (t.momentId === 'vote') {
        seen = t.n;
        onTotals?.(t.n, performance.now());
      }
    }
  }
  if (msg.t === 'presence') joined = msg.presence.audience;
};

const sockets: WebSocket[] = [];
const batch = 25;
for (let i = 0; i < phones; i += batch) {
  const group = await Promise.all(
    Array.from({ length: Math.min(batch, phones - i) }, (_, j) =>
      open(
        `${wsBase}/api/rooms/${room.code}/ws?role=audience&client=phone${String(i + j).padStart(6, '0')}`,
      ),
    ),
  );
  sockets.push(...group);
}
await sleep(300);
console.log(`  audience joined: ${joined}`);

const latencies: number[] = [];
for (let round = 0; round < rounds; round++) {
  const momentId = 'vote';
  host.send(JSON.stringify({ t: 'moments', title: 'Load test', open: [] }));
  await sleep(300);
  host.send(
    JSON.stringify({
      t: 'moments',
      title: 'Load test',
      open: [
        {
          id: momentId,
          type: 'vote',
          prompt: 'Left or right?',
          options: [
            { id: 'left', label: 'Left' },
            { id: 'right', label: 'Right' },
          ],
          min: 0,
          max: 10,
          variants: [],
          moderated: false,
          closesAt: null,
        },
      ],
    }),
  );
  await sleep(500);
  seen = 0;
  const sentAt: number[] = [];
  const done = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`  round ${round + 1}: timed out with ${seen}/${phones} votes`);
      resolve();
    }, 15_000);
    onTotals = (n, at) => {
      // The k-th vote counted is matched with the k-th vote sent.
      while (
        latencies.length - round * phones < n &&
        sentAt[latencies.length - round * phones] !== undefined
      ) {
        latencies.push(at - sentAt[latencies.length - round * phones]!);
      }
      if (n >= phones) {
        clearTimeout(timeout);
        resolve();
      }
    };
  });
  // Phones vote spread over two seconds, like a real room.
  const order = sockets
    .map((ws, i) => ({ ws, i, delay: Math.random() * 2000 }))
    .sort((a, b) => a.delay - b.delay);
  const start = performance.now();
  for (const p of order) {
    const wait = start + p.delay - performance.now();
    if (wait > 0) await sleep(wait);
    sentAt.push(performance.now());
    p.ws.send(JSON.stringify({ t: 'vote', momentId, optionId: p.i % 3 ? 'left' : 'right' }));
  }
  await done;
  onTotals = null;
  console.log(`  round ${round + 1}: ${seen}/${phones} votes counted`);
}

const sorted = [...latencies].sort((a, b) => a - b);
console.log(`\nvote → host latency over ${sorted.length} votes:`);
console.log(
  `  p50 ${percentile(sorted, 50).toFixed(0)} ms   p95 ${percentile(sorted, 95).toFixed(0)} ms   max ${sorted.at(-1)?.toFixed(0)} ms`,
);
const ok = percentile(sorted, 95) < 1000 && sorted.length === phones * rounds;
console.log(ok ? 'PASS: p95 under 1 s' : 'FAIL: target is p95 under 1 s with every vote counted');
for (const s of sockets) s.close();
host.close();
process.exit(ok ? 0 : 1);
