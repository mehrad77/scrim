import { uid, type Layer, type LayerKind, type Media, type Output, type Show } from '@scrim/format';

const TEXT = {
  fontSize: 72,
  color: '#ffffff',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 600,
  align: 'center' as const,
  background: 'transparent',
};

function topZ(show: Show, outputId: string | null): number {
  return show.layers
    .filter((l) => l.outputId === outputId)
    .reduce((z, l) => Math.max(z, l.z + 1), 0);
}

/** Box of a given aspect ratio, contained in the output and centered. */
function fitBox(output: Output, aspect: number | null, scale = 1) {
  let w = output.width * scale;
  let h = output.height * scale;
  if (aspect) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  return {
    x: Math.round((output.width - w) / 2),
    y: Math.round((output.height - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

export function layerForMedia(show: Show, output: Output | undefined, media: Media): Layer {
  const base = {
    id: uid('lyr'),
    name: media.name.replace(/\.[^.]+$/, ''),
    opacity: 1,
    visible: false,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  if (media.kind === 'audio' || !output) {
    return {
      ...base,
      kind: 'audio',
      outputId: null,
      mediaId: media.id,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      z: topZ(show, null),
      loop: false,
      volume: 1,
      bus: show.audioBuses[0]?.id ?? 'main',
    };
  }
  const aspect = media.width && media.height ? media.width / media.height : null;
  const box = fitBox(output, aspect);
  if (media.kind === 'image') {
    return {
      ...base,
      ...box,
      kind: 'image',
      outputId: output.id,
      mediaId: media.id,
      fit: 'contain',
      z: topZ(show, output.id),
    };
  }
  return {
    ...base,
    ...box,
    kind: 'video',
    outputId: output.id,
    mediaId: media.id,
    fit: 'contain',
    loop: false,
    volume: 1,
    bus: show.audioBuses[0]?.id ?? 'main',
    z: topZ(show, output.id),
  };
}

export type SyntheticKind = Exclude<LayerKind, 'image' | 'video' | 'audio'> | 'countdown';

export function syntheticLayer(show: Show, output: Output, kind: SyntheticKind): Layer {
  const z = topZ(show, output.id);
  const base = {
    id: uid('lyr'),
    outputId: output.id,
    opacity: 1,
    visible: false,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    z,
  };
  const common = { ...base, ...TEXT };
  switch (kind) {
    case 'frame': {
      // A lower-third bar: on from the start, so one cue showing it shows what it holds.
      const w = Math.round(output.width * 0.4);
      const h = Math.round(output.height * 0.14);
      return {
        ...base,
        visible: true,
        x: Math.round((output.width - w) / 2),
        y: Math.round(output.height * 0.78),
        w,
        h,
        name: 'Frame',
        kind: 'frame',
        fill: '#202020',
        radius: 0,
        clip: false,
        layout: {
          mode: 'row',
          gap: 24,
          padX: 32,
          padY: 16,
          align: 'center',
          justify: 'start',
          hugW: true,
          hugH: true,
        },
      };
    }
    case 'text':
      return {
        ...common,
        ...fitBox(output, output.width / output.height, 0.8),
        h: Math.round(output.height * 0.25),
        y: Math.round(output.height * 0.375),
        name: 'Text',
        kind: 'text',
        text: 'New text',
      };
    case 'countdown':
      return {
        ...common,
        x: Math.round(output.width * 0.35),
        y: Math.round(output.height * 0.4),
        w: Math.round(output.width * 0.3),
        h: Math.round(output.height * 0.2),
        name: 'Countdown',
        kind: 'counter',
        mode: 'countdown',
        start: 60,
        format: 'clock',
        fontSize: 140,
        fontFamily: 'ui-monospace, monospace',
      };
    case 'counter':
      return {
        ...common,
        x: Math.round(output.width * 0.4),
        y: Math.round(output.height * 0.4),
        w: Math.round(output.width * 0.2),
        h: Math.round(output.height * 0.2),
        name: 'Counter',
        kind: 'counter',
        mode: 'count',
        start: 0,
        format: 'number',
        fontSize: 140,
      };
    case 'state':
      return {
        ...common,
        x: Math.round(output.width * 0.2),
        y: Math.round(output.height * 0.7),
        w: Math.round(output.width * 0.6),
        h: Math.round(output.height * 0.2),
        name: 'State value',
        kind: 'state',
        varId: show.vars[0]?.id ?? '',
        display: 'value',
      };
  }
}

export function layerKindLabel(layer: Layer): string {
  switch (layer.kind) {
    case 'counter':
      return layer.mode === 'countdown'
        ? 'Countdown'
        : layer.mode === 'countup'
          ? 'Stopwatch'
          : 'Counter';
    case 'state':
      return layer.display === 'bars' ? 'Tally bars' : 'State value';
    default:
      return layer.kind[0]!.toUpperCase() + layer.kind.slice(1);
  }
}
