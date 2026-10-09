import { createCue, createShow, uid, type Layer, type Show } from '@scrim/format';
import { addMediaBlob } from '../storage/media.js';

async function paint(
  name: string,
  draw: (ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) => void,
) {
  const w = 1920;
  const h = 1080;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  return addMediaBlob(await canvas.convertToBlob({ type: 'image/png' }), name);
}

function gradient(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, stops: string[]) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function door(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 300, 560, [150, 150, 8, 8]);
  ctx.fill();
  ctx.fillStyle = '#f5d68a';
  ctx.beginPath();
  ctx.arc(x + 250, y + 320, 14, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * "The Two Doors": a ten-minute interactive demo. The audience votes on a
 * door; a rule branches to the winning scene; a performer remote rings a bell.
 */
export async function createDemoShow(): Promise<Show> {
  const show = createShow('The Two Doors (demo)');
  const out = show.outputs[0]!;
  const [hall, cellar, attic] = await Promise.all([
    paint('hallway.png', (ctx, w, h) => {
      gradient(ctx, w, h, ['#1e1b4b', '#0f172a', '#020617']);
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      door(ctx, w * 0.25, h * 0.3, '#7c2d12');
      door(ctx, w * 0.6, h * 0.3, '#14532d');
    }),
    paint('cellar.png', (ctx, w, h) => {
      gradient(ctx, w, h, ['#431407', '#1c0a00', '#000000']);
      ctx.strokeStyle = 'rgba(251,146,60,.25)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 14; i++) ctx.strokeRect(i * 150 - 20, h * 0.55 + (i % 2) * 60, 160, 60);
    }),
    paint('attic.png', (ctx, w, h) => {
      gradient(ctx, w, h, ['#ecfeff', '#a5f3fc', '#164e63']);
      ctx.fillStyle = 'rgba(8,47,73,.6)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.4);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w, h * 0.4);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.fill();
    }),
  ]);
  show.media = [hall, cellar, attic];

  const base = {
    outputId: out.id,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    opacity: 1,
    visible: false,
  };
  const full = { x: 0, y: 0, w: out.width, h: out.height };
  const text = {
    fontFamily: 'Georgia, serif',
    fontWeight: 600,
    align: 'center' as const,
    background: 'transparent',
    color: '#ffffff',
  };
  const L = {
    hall: uid('lyr'),
    cellar: uid('lyr'),
    attic: uid('lyr'),
    title: uid('lyr'),
    welcome: uid('lyr'),
    question: uid('lyr'),
    bars: uid('lyr'),
    timer: uid('lyr'),
    ending: uid('lyr'),
    bell: uid('lyr'),
  };
  const layers: Layer[] = [
    {
      ...base,
      ...full,
      id: L.hall,
      name: 'Hallway',
      kind: 'image',
      mediaId: hall.id,
      fit: 'cover',
      z: 0,
    },
    {
      ...base,
      ...full,
      id: L.cellar,
      name: 'Cellar',
      kind: 'image',
      mediaId: cellar.id,
      fit: 'cover',
      z: 1,
    },
    {
      ...base,
      ...full,
      id: L.attic,
      name: 'Attic',
      kind: 'image',
      mediaId: attic.id,
      fit: 'cover',
      z: 2,
    },
    {
      ...base,
      ...text,
      id: L.welcome,
      name: 'Welcome',
      kind: 'text',
      x: 160,
      y: 300,
      w: 1600,
      h: 480,
      z: 10,
      visible: true,
      fontSize: 84,
      text: 'Welcome.\nTake out your phone and scan the code\nyou were given at the door.',
    },
    {
      ...base,
      ...text,
      id: L.title,
      name: 'Title',
      kind: 'text',
      x: 160,
      y: 80,
      w: 1600,
      h: 200,
      z: 11,
      fontSize: 120,
      text: 'The Two Doors',
    },
    {
      ...base,
      ...text,
      id: L.question,
      name: 'Question',
      kind: 'text',
      x: 160,
      y: 60,
      w: 1600,
      h: 160,
      z: 12,
      fontSize: 80,
      text: 'Which door do we open?',
    },
    {
      ...base,
      ...text,
      id: L.bars,
      name: 'Live tally',
      kind: 'state',
      varId: 'tally',
      display: 'bars',
      x: 360,
      y: 820,
      w: 1200,
      h: 200,
      z: 13,
      fontSize: 64,
      color: '#fbbf24',
    },
    {
      ...base,
      ...text,
      id: L.timer,
      name: 'Vote timer',
      kind: 'counter',
      mode: 'countdown',
      start: 20,
      format: 'clock',
      x: 1600,
      y: 60,
      w: 260,
      h: 120,
      z: 14,
      fontSize: 72,
      fontFamily: 'ui-monospace, monospace',
    },
    {
      ...base,
      ...text,
      id: L.ending,
      name: 'Ending',
      kind: 'text',
      x: 160,
      y: 380,
      w: 1600,
      h: 320,
      z: 15,
      fontSize: 96,
      text: '{{door}} it was.\nThank you for playing.',
    },
    {
      ...base,
      ...text,
      id: L.bell,
      name: 'Bell flash',
      kind: 'text',
      x: 0,
      y: 0,
      w: out.width,
      h: out.height,
      z: 20,
      fontSize: 300,
      text: '🔔',
      background: 'rgba(255,255,255,.15)',
    },
  ];
  show.layers = layers;

  show.vars = [
    { id: 'door', name: 'door', type: 'choice', initial: '', options: ['left', 'right'] },
    { id: 'tally', name: 'tally', type: 'tally', initial: { left: 0, right: 0 } },
    { id: 'bells', name: 'bells', type: 'number', initial: 0 },
  ];
  const vote = uid('mom');
  show.moments = [
    {
      id: vote,
      name: 'Door vote',
      type: 'vote',
      prompt: 'Which door do we open?',
      options: [
        { id: 'left', label: 'The red door' },
        { id: 'right', label: 'The green door' },
      ],
      min: 0,
      max: 10,
      variants: [],
      durationSec: 20,
      resultVarId: 'door',
      tallyVarId: 'tally',
      defaultResult: 'left',
      moderated: true,
    },
  ];
  const bell = uid('trg');
  show.triggers = [{ id: bell, name: 'Bell', color: '#f59e0b' }];

  const S = {
    pre: uid('scn'),
    act: uid('scn'),
    cellar: uid('scn'),
    attic: uid('scn'),
    end: uid('scn'),
  };
  show.scenes = [
    { id: S.pre, name: 'Preshow' },
    { id: S.act, name: 'The hallway' },
    { id: S.cellar, name: 'Cellar (red door)' },
    { id: S.attic, name: 'Attic (green door)' },
    { id: S.end, name: 'Ending' },
  ];
  const fade = (s: number) => ({ duration: s, easing: 'easeInOut' as const });
  const cue = (
    scene: string,
    name: string,
    actions: Show['cues'][number]['actions'],
    follow?: number,
  ) => ({
    ...createCue(scene, name),
    actions,
    follow: follow === undefined ? { auto: false, delay: 0 } : { auto: true, delay: follow },
  });
  show.cues = [
    cue(S.pre, 'House open', []),
    cue(S.act, 'Lights down, hallway', [
      { type: 'hide', layerId: L.welcome, ...fade(1.5) },
      { type: 'show', layerId: L.hall, ...fade(3) },
      { type: 'show', layerId: L.title, ...fade(3) },
    ]),
    cue(S.act, 'Ask the audience', [
      { type: 'hide', layerId: L.title, ...fade(1) },
      { type: 'show', layerId: L.question, ...fade(1) },
      { type: 'show', layerId: L.bars, ...fade(1) },
      { type: 'show', layerId: L.timer, ...fade(1) },
      { type: 'counter', layerId: L.timer, op: 'reset' },
      { type: 'counter', layerId: L.timer, op: 'start' },
      { type: 'openMoment', momentId: vote },
    ]),
    cue(S.cellar, 'Down to the cellar', [
      { type: 'stopAll', duration: 1 },
      { type: 'show', layerId: L.cellar, ...fade(4) },
    ]),
    cue(S.cellar, 'Cellar ending', [], 0),
    cue(S.attic, 'Up to the attic', [
      { type: 'stopAll', duration: 1 },
      { type: 'show', layerId: L.attic, ...fade(4) },
    ]),
    cue(S.end, 'Ending', [{ type: 'show', layerId: L.ending, ...fade(2) }]),
    cue(S.end, 'Blackout', [{ type: 'stopAll', duration: 4 }]),
  ];
  // The cellar ending jumps over the attic scene.
  show.cues[4]!.actions = [{ type: 'jumpScene', sceneId: S.end, fire: false }];
  show.cues[4]!.follow = { auto: false, delay: 0 };
  show.cues[3]!.follow = { auto: true, delay: 0 };

  show.rules = [
    {
      id: uid('rul'),
      name: 'Vote closes: hide the vote',
      enabled: true,
      when: { type: 'momentClosed', momentId: vote },
      if: [],
      then: [
        { type: 'hide', layerId: L.question, ...fade(1) },
        { type: 'hide', layerId: L.bars, ...fade(1) },
        { type: 'hide', layerId: L.timer, ...fade(1) },
        { type: 'counter', layerId: L.timer, op: 'pause' },
      ],
    },
    {
      id: uid('rul'),
      name: 'Red door wins → cellar',
      enabled: true,
      when: { type: 'momentClosed', momentId: vote },
      if: [{ varId: 'door', op: 'eq', value: 'left' }],
      then: [{ type: 'jumpScene', sceneId: S.cellar, fire: false }],
    },
    {
      id: uid('rul'),
      name: 'Green door wins → attic',
      enabled: true,
      when: { type: 'momentClosed', momentId: vote },
      if: [{ varId: 'door', op: 'eq', value: 'right' }],
      then: [{ type: 'jumpScene', sceneId: S.attic, fire: false }],
    },
    {
      id: uid('rul'),
      name: 'Performer rings the bell',
      enabled: true,
      when: { type: 'trigger', triggerId: bell },
      if: [],
      then: [
        { type: 'addVar', varId: 'bells', amount: 1 },
        { type: 'show', layerId: L.bell, duration: 0, easing: 'linear' },
        { type: 'hide', layerId: L.bell, duration: 1.2, easing: 'easeOut' },
      ],
    },
  ];
  show.inputs.keys.push({ key: 'b', command: { type: 'trigger', triggerId: bell } });
  return show;
}
