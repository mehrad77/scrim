import { describe, expect, it } from 'vitest';
import {
  createCue,
  createShow,
  cueOrder,
  parseShow,
  readBundle,
  ShowFormatError,
  writeBundle,
  type Show,
} from './index.js';

function bytes(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 0xff;
  return out;
}

function streamOf(data: Uint8Array, chunk = 1000): ReadableStream<Uint8Array> {
  let o = 0;
  return new ReadableStream({
    pull(c) {
      if (o >= data.length) return c.close();
      c.enqueue(data.slice(o, o + chunk));
      o += chunk;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function showWithMedia(): Show {
  const show = createShow('Test');
  show.media.push(
    { id: 'med_a', kind: 'image', name: 'a.png', mime: 'image/png', size: 5000 },
    { id: 'med_b', kind: 'video', name: 'b.mp4', mime: 'video/mp4', size: 70_000 },
  );
  return show;
}

describe('parseShow', () => {
  it('accepts a fresh show and fills defaults', () => {
    const show = createShow('Hello');
    const raw = JSON.parse(JSON.stringify(show));
    delete raw.outputs[0].safeArea;
    expect(parseShow(raw).outputs[0]!.safeArea).toBe(0.05);
  });

  it('rejects other documents and newer versions', () => {
    expect(() => parseShow({ format: 'nope' })).toThrow(ShowFormatError);
    expect(() => parseShow({ ...createShow('x'), version: 99 })).toThrow(/newer Scrim/);
  });

  it('validates nested branch actions', () => {
    const show = createShow('x');
    show.cues[0]!.actions.push({
      type: 'branch',
      if: [{ varId: 'v', op: 'eq', value: 'left' }],
      then: [{ type: 'jumpScene', sceneId: 's', fire: false }],
      else: [],
    });
    expect(parseShow(JSON.parse(JSON.stringify(show))).cues[0]!.actions[0]!.type).toBe('branch');
  });
});

describe('cueOrder', () => {
  it('orders by scene, then cue position', () => {
    const show = createShow('x');
    const s2 = { id: 's2', name: 'Two' };
    show.scenes.unshift(s2);
    const c = createCue('s2', 'first');
    show.cues.push(c);
    expect(cueOrder(show).map((q) => q.name)).toEqual(['first', 'Preshow']);
  });
});

describe('bundle', () => {
  it('round-trips a show and its media', async () => {
    const show = showWithMedia();
    const media = { med_a: bytes(5000, 1), med_b: bytes(70_000, 2) } as Record<string, Uint8Array>;
    const zip = await collect(
      writeBundle(
        show,
        show.media.map((m) => ({ id: m.id, open: () => streamOf(media[m.id]!) })),
      ),
    );
    const received: Record<string, Uint8Array[]> = {};
    const read = await readBundle(streamOf(zip, 777), {
      openMedia(id) {
        received[id] = [];
        return { write: (c) => void received[id]!.push(c.slice()), close: () => undefined };
      },
    });
    expect(read).toEqual(show);
    for (const id of Object.keys(media)) {
      const chunks = received[id]!;
      const got = await collect(
        new ReadableStream({ start: (c) => (chunks.forEach((x) => c.enqueue(x)), c.close()) }),
      );
      expect(got).toEqual(media[id]);
    }
  });

  it('reports missing media', async () => {
    const show = showWithMedia();
    const zip = await collect(
      writeBundle(show, [{ id: 'med_a', open: () => streamOf(bytes(10, 0)) }]),
    );
    await expect(
      readBundle(streamOf(zip), { openMedia: () => ({ write() {}, close() {} }) }),
    ).rejects.toThrow(/missing media: b.mp4/);
  });
});

describe('unfinished references', () => {
  it('round-trips a show whose designer has not picked every target yet', () => {
    const show = createShow('Draft');
    const out = show.outputs[0]!.id;
    show.layers.push({
      id: 'l',
      name: 'State',
      kind: 'state',
      outputId: out,
      varId: '',
      display: 'value',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      z: 0,
      opacity: 1,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      fontSize: 10,
      color: '#fff',
      fontFamily: 'x',
      fontWeight: 400,
      align: 'center',
      background: 'transparent',
    });
    show.cues[0]!.actions.push(
      { type: 'show', layerId: '', duration: 0, easing: 'linear' },
      { type: 'openMoment', momentId: '' },
    );
    show.rules.push({
      id: 'r',
      name: 'r',
      enabled: true,
      when: { type: 'trigger', triggerId: '' },
      if: [{ varId: '', op: 'eq', value: '' }],
      then: [],
    });
    show.inputs.keys.push({ key: 'x', command: { type: 'trigger', triggerId: '' } });
    expect(parseShow(JSON.parse(JSON.stringify(show)))).toEqual(show);
  });
});
