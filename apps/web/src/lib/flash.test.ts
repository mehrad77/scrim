import { createCue, createShow, type Action, type Layer, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { checkFlashes, luminance } from './flash.js';
import { checkLogic } from './logic.js';

/** One output with a full-screen picture, a small badge, and a black frame on black. */
function stage(): Show {
  const show = createShow('Flashes');
  const out = show.outputs[0]!;
  const base = {
    outputId: out.id,
    x: 0,
    y: 0,
    z: 0,
    opacity: 1,
    visible: false,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  show.layers = [
    {
      ...base,
      id: 'pic',
      name: 'Picture',
      kind: 'image',
      mediaId: 'm',
      fit: 'cover',
      w: out.width,
      h: out.height,
    },
    {
      ...base,
      id: 'badge',
      name: 'Badge',
      kind: 'image',
      mediaId: 'm',
      fit: 'cover',
      w: 200,
      h: 200,
    },
    {
      ...base,
      id: 'dark',
      name: 'Dark',
      kind: 'frame',
      fill: '#000000',
      radius: 0,
      clip: false,
      w: out.width,
      h: out.height,
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
    },
  ] satisfies Layer[];
  show.scenes = [{ id: 's', name: 'Scene' }];
  return show;
}

/** A cue that toggles a layer every `gap` seconds, `times` times, with cuts. */
function strobe(layerId: string, gap: number, times: number, duration = 0): Action[] {
  return Array.from({ length: times }, (_, i) => ({
    type: i % 2 ? 'hide' : 'show',
    layerId,
    duration,
    easing: 'linear',
    delay: i * gap,
  })) as Action[];
}

function cue(show: Show, name: string, actions: Action[]) {
  const c = { ...createCue('s', name), actions };
  show.cues.push(c);
  return c;
}

describe('flash check', () => {
  it('flags a cue that flashes the output more than three times a second', () => {
    const show = stage();
    const c = cue(show, 'Strobe', strobe('pic', 0.1, 12));
    const [issue, ...rest] = checkFlashes(show);
    expect(rest).toHaveLength(0);
    expect(issue).toMatchObject({ cueId: c.id, outputId: show.outputs[0]!.id, flashes: 5 });
    expect(checkLogic(show).find((i) => i.id.startsWith('flash:'))?.text).toBe(
      'Cue “Strobe” flashes 5 times a second; more than 3 can trigger seizures',
    );
  });

  it('passes three flashes a second, slow fades, small layers and dark on dark', () => {
    const show = stage();
    cue(show, 'Three a second', strobe('pic', 1 / 6, 6));
    cue(show, 'Slow fades', strobe('pic', 1, 6, 1));
    cue(show, 'Small badge', strobe('badge', 0.1, 12));
    cue(show, 'Dark frame', strobe('dark', 0.1, 12));
    expect(checkFlashes(show)).toEqual([]);
  });

  it('checks the ordinary performance of a show that starts relaxed', () => {
    const show = stage();
    show.relaxed = { default: true };
    show.layers[0]!.intense = true;
    cue(show, 'Strobe', strobe('pic', 0.1, 12));
    expect(checkFlashes(show)).toHaveLength(1);
  });

  it('counts a see-through colour by how much it covers the background', () => {
    const show = stage();
    show.outputs[0]!.background = '#ffffff';
    const dark = show.layers.find((l) => l.id === 'dark')!;
    if (dark.kind !== 'frame') throw new Error('frame');
    dark.fill = 'transparent';
    cue(show, 'Empty frame', strobe('dark', 0.1, 12));
    expect(checkFlashes(show)).toEqual([]);
    dark.fill = 'rgba(0, 0, 0, 0.9)';
    expect(checkFlashes(structuredClone(show))).toHaveLength(1);
    dark.fill = 'rgba(0, 0, 0, 0.1)';
    expect(checkFlashes(structuredClone(show))).toEqual([]);
  });

  it('follows auto-follows and reports a strobe of cues once, at its first cue', () => {
    const show = stage();
    const on = cue(show, 'On', [{ type: 'show', layerId: 'pic', duration: 0, easing: 'linear' }]);
    const off = cue(show, 'Off', [{ type: 'hide', layerId: 'pic', duration: 0, easing: 'linear' }]);
    cue(show, 'Again', [{ type: 'goToCue', cueId: on.id, fire: true }]);
    on.follow = { auto: true, delay: 0.1 };
    off.follow = { auto: true, delay: 0.1 };
    // On, Off, then Again fires On: a loop five times a second.
    expect(checkFlashes(show)).toMatchObject([{ cueId: on.id, flashes: 5 }]);
  });

  it('measures colours by relative luminance', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000')).toBe(0);
    expect(luminance('transparent')).toBe(0);
    expect(luminance('#808080')).toBeCloseTo(0.216, 2);
    expect(luminance('rebeccapurple')).toBeNull();
  });
});
