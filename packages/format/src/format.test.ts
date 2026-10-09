import { describe, expect, it } from 'vitest';
import {
  createCue,
  createShow,
  ancestorsOf,
  cueOrder,
  descendantsOf,
  hugAxes,
  layerTree,
  parseShow,
  readBundle,
  ShowFormatError,
  writeBundle,
  type Layer,
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

  it('keeps the optional cue fields: tape and the performer a cue waits for', () => {
    const show = createShow('x');
    show.triggers.push({ id: 'trg_bell', name: 'Bell', color: '#d97706' });
    show.cues.push({
      ...createCue(show.scenes[0]!.id, 'Bell rings'),
      tape: 3,
      waitFor: 'trg_bell',
    });
    const cue = parseShow(JSON.parse(JSON.stringify(show))).cues.at(-1)!;
    expect(cue.waitFor).toBe('trg_bell');
    expect(cue.tape).toBe(3);
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

describe('frames', () => {
  const base = { x: 0, y: 0, w: 100, h: 50, z: 0, opacity: 1, visible: true };
  const frame = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, name: id, kind: 'frame', outputId: 'out', ...base, ...extra }) as unknown as Layer;
  const text = (id: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      name: id,
      kind: 'text',
      outputId: 'out',
      text: id,
      ...base,
      ...extra,
    }) as unknown as Layer;

  it('parse with their defaults, and older shows still parse', () => {
    const show = createShow('Frames');
    const out = show.outputs[0]!.id;
    const raw = JSON.parse(JSON.stringify(show));
    raw.layers = [
      {
        id: 'f',
        name: 'Lower third',
        kind: 'frame',
        outputId: out,
        ...base,
        pin: { x: 'right', y: 'bottom' },
      },
      {
        id: 't',
        name: 'Name',
        kind: 'text',
        outputId: out,
        text: 'Ada',
        ...base,
        parentId: 'f',
        sizing: 'autoWidth',
        locked: true,
      },
    ];
    const parsed = parseShow(raw);
    const [f, t] = parsed.layers;
    expect(f).toMatchObject({
      fill: 'transparent',
      radius: 0,
      clip: false,
      layout: {
        mode: 'free',
        gap: 0,
        padX: 0,
        padY: 0,
        align: 'center',
        justify: 'start',
        hugW: false,
        hugH: false,
      },
      pin: { x: 'right', y: 'bottom' },
    });
    expect(t).toMatchObject({ parentId: 'f', sizing: 'autoWidth', locked: true });
    // A show from before frames has no parentId, pin or sizing at all.
    expect(parseShow(JSON.parse(JSON.stringify(show))).layers).toEqual([]);
  });

  it('reject a pin outside the nine anchors', () => {
    const show = JSON.parse(JSON.stringify(createShow('Bad pin')));
    show.layers = [{ ...frame('f'), outputId: show.outputs[0].id, pin: { x: 'middle', y: 'top' } }];
    expect(() => parseShow(show)).toThrow(ShowFormatError);
  });

  it('build a tree in list order, front first', () => {
    const tree = layerTree([
      frame('f', { z: 1 }),
      text('a', { parentId: 'f', z: 0 }),
      text('b', { parentId: 'f', z: 2 }),
      frame('g', { parentId: 'f', z: 1 }),
      text('c', { parentId: 'g' }),
      text('top', { z: 3 }),
    ]);
    expect(tree.roots.map((l) => l.id)).toEqual(['top', 'f']);
    expect(tree.children('f').map((l) => l.id)).toEqual(['b', 'g', 'a']);
    expect(ancestorsOf(tree, 'c').map((l) => l.id)).toEqual(['g', 'f']);
    expect(descendantsOf(tree, 'f').map((l) => l.id)).toEqual(['b', 'g', 'c', 'a']);
  });

  it('draw broken links on the output instead of throwing', () => {
    const tree = layerTree([
      text('orphan', { parentId: 'gone' }),
      text('host'),
      text('notAFrame', { parentId: 'host' }),
      frame('other', { outputId: 'out2' }),
      text('crossOutput', { parentId: 'other' }),
      { ...frame('f'), kind: 'audio', outputId: null } as unknown as Layer,
      frame('a', { parentId: 'b' }),
      frame('b', { parentId: 'a' }),
    ]);
    for (const id of ['orphan', 'notAFrame', 'crossOutput', 'f'])
      expect(tree.parent(id), id).toBeUndefined();
    // A loop is cut once: one of the two frames ends up on the output.
    expect([tree.parent('a')?.id, tree.parent('b')?.id].filter(Boolean)).toHaveLength(1);
    expect(tree.roots.length + tree.children('a').length + tree.children('b').length).toBe(8);
  });

  it('hug only on row and column frames and auto-sized text', () => {
    const layout = { mode: 'free', hugW: true, hugH: true };
    expect(hugAxes(frame('f', { layout }))).toEqual({ w: false, h: false });
    expect(hugAxes(frame('f', { layout: { ...layout, mode: 'row' } }))).toEqual({
      w: true,
      h: true,
    });
    expect(hugAxes(text('t', { sizing: 'autoWidth' }))).toEqual({ w: true, h: true });
    expect(hugAxes(text('t', { sizing: 'autoHeight' }))).toEqual({ w: false, h: true });
    expect(hugAxes(text('t'))).toEqual({ w: false, h: false });
  });
});
