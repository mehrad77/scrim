import type { Action, Show, TextLayer } from '@scrim/format';
import { addCue, addScene, fadeIn, fadeOut, follows, outputOf, say, textLayer } from './common.js';

export interface Notice {
  title: string;
  body: string;
}

export interface NoticesOptions {
  notices: Notice[];
  /** Seconds each notice stays up. */
  seconds: number;
  /** Go round again after the last one, until the operator moves on. */
  loop: boolean;
  outputId?: string;
}

/**
 * Notices before a gathering or between songs: a title and a line or two each, changing on
 * their own and going round again if asked.
 *
 * Each notice crossfades in on a layer pair the one before isn't using, so its words are set
 * while that pair is dark: nothing waits on a timer (which a relaxed performance's slower fades
 * or an early "off" could overtake), and no word ever changes on screen. A loop ends from its
 * own scene, so "next scene" reaches the end cue and nothing is left on stage.
 */
export function buildNotices(show: Show, opts: NoticesOptions) {
  const output = outputOf(show, opts.outputId);
  const k = opts.notices.length;
  // Two pairs take turns; going round with an odd number needs a third, or the last notice
  // and the first would share one.
  const count = k < 2 ? 1 : opts.loop && k % 2 === 1 ? 3 : 2;
  const pairs = Array.from({ length: count }, (_, p) => {
    const n = p ? ` ${p + 1}` : '';
    return {
      title: textLayer(show, output, `Notice title${n}`, [0.08, 0.28, 0.84, 0.16], {
        fontSize: Math.round(output.height / 12),
        fontWeight: 700,
      }),
      body: textLayer(show, output, `Notice text${n}`, [0.12, 0.46, 0.76, 0.3], {
        fontSize: Math.round(output.height / 20),
        fontWeight: 400,
      }),
    };
  });
  const pairOf = (i: number) => (count === 3 && i === k - 1 ? 2 : i % count);
  const layers = (p: { title: TextLayer; body: TextLayer }) => [p.title.id, p.body.id];

  const scene = addScene(show, 'Notices');
  const cueIds: string[] = [];
  opts.notices.forEach((n, i) => {
    const mine = pairs[pairOf(i)]!;
    const actions: Action[] = [
      say(mine.title.id, n.title),
      say(mine.body.id, n.body),
      ...layers(mine).map((id) => fadeIn(show, id)),
      ...pairs.filter((p) => p !== mine).flatMap((p) => layers(p).map((id) => fadeOut(show, id))),
    ];
    const last = i === k - 1;
    const cue = addCue(show, scene.id, n.title || `Notice ${i + 1}`, actions, {
      ...(last && !opts.loop ? {} : follows(Math.max(2, opts.seconds))),
      access: { caption: [n.title, n.body].filter(Boolean).join('. ') },
    });
    cueIds.push(cue.id);
  });
  if (opts.loop && cueIds.length)
    cueIds.push(
      addCue(show, scene.id, 'Round again', [{ type: 'goToCue', cueId: cueIds[0]!, fire: true }])
        .id,
    );
  const off = pairs.flatMap((p) => layers(p).map((id) => fadeOut(show, id)));
  // Going round, GO stays in the loop; the end is the next scene, which "next scene" reaches.
  const endScene = opts.loop ? addScene(show, 'Notices off') : scene;
  cueIds.push(addCue(show, endScene.id, 'Notices off', off, { access: { caption: '' } }).id);
  return { sceneId: scene.id, cueIds };
}
