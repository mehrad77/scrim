import { createResultVars, newMoment } from '../lib/moments.js';
import { addCue, addScene } from '../lib/build/common.js';
import { did } from '../lib/learn.js';
import { addMedia, cols, fade, kit, panel, place, rule, startShow, type, words } from './layout.js';
import type { TemplateSeed } from './types.js';

/**
 * A small template that only uses the shared fonts: the harness's own test subject, and the
 * proof that a seed runs from fetch to stage. Not in the gallery.
 */
export const FIXTURE_SEED: TemplateSeed = {
  id: 'fixture',
  title: 'Fixture',
  group: 'family',
  forWho: 'The template tests',
  blurb: 'A title, a vote and two endings.',
  needs: ['A screen'],
  replace: ['The words'],
  limits: ['It is a test.'],
  assets: [
    { key: 'display', path: 'fonts/Fraunces.woff2' },
    { key: 'body', path: 'fonts/AtkinsonHyperlegibleNext.woff2' },
  ],
  learn: [
    { id: 'title', title: 'Change the title', hint: 'Type your own.', done: did.text('Title') },
    { id: 'go', title: 'Press GO', hint: 'Space.', done: did.go },
  ],
  visual: { minText: 56, minContrast: 4.5 },
  make(media) {
    const show = startShow('Fixture');
    addMedia(show, media);
    const k = kit(show);
    const ink = '#1d1a16';
    const plate = panel(k, 'Title plate', cols(2, 10, 320, 440), '#f4ecd8', { radius: 24 });
    const title = place(
      k,
      plate,
      words(k, 'Title', { x: 0, y: 0, w: plate.w, h: 200 }, 'The two roads', {
        ...type({ font: media.display!, weight: 800, letterSpacing: -0.01 }, 140, ink),
      }),
      { x: 0, y: 40 },
    );
    const sub = place(
      k,
      plate,
      words(k, 'Subtitle', { x: 0, y: 0, w: plate.w, h: 100 }, 'Which way should we go?', {
        ...type({ font: media.body!, weight: 500 }, 64, ink),
      }),
      { x: 0, y: 280 },
    );
    void title;
    void sub;
    const ending = words(k, 'Ending', cols(2, 10, 440, 200), '', {
      ...type({ font: media.display!, weight: 700 }, 120, '#ffffff'),
      shadow: 'strong',
    });

    const vote = newMoment('vote', show);
    vote.name = 'Which road';
    vote.prompt = 'Which way should we go?';
    vote.options = [
      { id: 'a', label: 'The river' },
      { id: 'b', label: 'The hills' },
    ];
    vote.defaultResult = 'a';
    createResultVars(show, vote);
    show.moments.push(vote);

    const start = addScene(show, 'The two roads');
    addCue(show, start.id, 'Title', [fade(plate.id, true, 1.2)]);
    addCue(show, start.id, 'Ask', [{ type: 'openMoment', momentId: vote.id }]);
    addCue(show, start.id, 'Decide', [{ type: 'closeMoment', momentId: vote.id }]);
    const river = addScene(show, 'The river');
    addCue(show, river.id, 'River', [
      fade(plate.id, false, 1),
      { type: 'setText', layerId: ending.id, text: 'Down to the river' },
      fade(ending.id, true, 1.2),
    ]);
    const hills = addScene(show, 'The hills');
    addCue(show, hills.id, 'Hills', [
      fade(plate.id, false, 1),
      { type: 'setText', layerId: ending.id, text: 'Up into the hills' },
      fade(ending.id, true, 1.2),
    ]);
    for (const [option, scene] of [
      ['a', river],
      ['b', hills],
    ] as const)
      rule(
        show,
        `Go to ${scene.name}`,
        { type: 'momentClosed', momentId: vote.id },
        [{ varId: vote.resultVarId!, op: 'eq', value: option }],
        [{ type: 'jumpScene', sceneId: scene.id, fire: true }],
      );
    return show;
  },
};
