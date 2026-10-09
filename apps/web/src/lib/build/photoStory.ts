import {
  uid,
  type Action,
  type AudioLayer,
  type ImageLayer,
  type Media,
  type Show,
} from '@scrim/format';
import { addCue, addLayer, addScene, follows, outputOf } from './common.js';

export interface PhotoStoryOptions {
  title: string;
  /** Pictures already stored on this machine, in the order shown. */
  photos: Media[];
  music?: Media | null;
  /** Seconds each picture stays up. */
  seconds: number;
  /** Seconds each picture takes to dissolve into the next: soft, never a cut. */
  fade: number;
  loop: boolean;
  outputId?: string;
}

/**
 * A photo story: pictures dissolving one into the next on their own, with music under them, for
 * a memory session, a birthday or a waiting room. Going round again keeps the music looping too.
 */
export function buildPhotoStory(show: Show, opts: PhotoStoryOptions) {
  const output = outputOf(show, opts.outputId);
  for (const m of [...opts.photos, ...(opts.music ? [opts.music] : [])])
    if (!show.media.some((x) => x.id === m.id)) show.media.push(m);
  const z = show.layers
    .filter((l) => l.outputId === output.id)
    .reduce((n, l) => Math.max(n, l.z + 1), 0);
  const fade = { duration: Math.max(0.5, opts.fade), easing: 'easeInOut' as const };
  const pictures = opts.photos.map((m, i) =>
    addLayer<ImageLayer>(show, {
      id: uid('lyr'),
      name: m.name.replace(/\.[^.]+$/, ''),
      kind: 'image',
      outputId: output.id,
      mediaId: m.id,
      fit: 'cover',
      x: 0,
      y: 0,
      w: output.width,
      h: output.height,
      // Later pictures above earlier ones, so each dissolves in over the last.
      z: z + i,
      opacity: 1,
      visible: false,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
    }),
  );
  const music =
    opts.music &&
    addLayer<AudioLayer>(show, {
      id: uid('lyr'),
      name: opts.music.name.replace(/\.[^.]+$/, ''),
      kind: 'audio',
      outputId: null,
      mediaId: opts.music.id,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      z: 0,
      opacity: 1,
      visible: true,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      loop: opts.loop,
      volume: 0.8,
      bus: show.audioBuses[0]?.id ?? 'main',
    });

  const scene = addScene(show, opts.title || 'Photo story');
  const hold = Math.max(fade.duration + 1, opts.seconds);
  const cueIds = pictures.map((p, i) => {
    const actions: Action[] = [{ type: 'show', layerId: p.id, ...fade }];
    const before = pictures[i - 1];
    // The picture underneath goes once the new one covers it.
    if (before)
      actions.push({
        type: 'hide',
        layerId: before.id,
        duration: 0,
        easing: 'linear',
        delay: fade.duration,
      });
    // The first picture is the lowest: going round again, or back to the start from anywhere,
    // whatever is above it dissolves away to it.
    if (i === 0)
      for (const other of pictures.slice(1))
        actions.push({ type: 'hide', layerId: other.id, ...fade });
    if (i === 0 && music)
      actions.push(
        // Its level back up, in case the end of an earlier run faded it out.
        { type: 'show', layerId: music.id, duration: 0, easing: 'linear' },
        // Round again, the music carries on instead of starting over.
        { type: 'play', layerId: music.id, restart: !opts.loop },
      );
    const last = i === pictures.length - 1;
    return addCue(show, scene.id, p.name, actions, last && !opts.loop ? {} : follows(hold)).id;
  });
  if (opts.loop && cueIds.length)
    cueIds.push(
      addCue(show, scene.id, 'Round again', [{ type: 'goToCue', cueId: cueIds[0]!, fire: true }])
        .id,
    );
  const out: Action[] = pictures.map((p) => ({
    type: 'hide',
    layerId: p.id,
    duration: 2,
    easing: 'easeInOut',
  }));
  if (music)
    out.push(
      { type: 'hide', layerId: music.id, duration: 3, easing: 'easeInOut' },
      { type: 'pause', layerId: music.id, delay: 3 },
    );
  // Going round, GO stays in the loop; the end is the next scene, which "next scene" reaches.
  const endScene = opts.loop ? addScene(show, `${scene.name}: the end`) : scene;
  cueIds.push(addCue(show, endScene.id, 'The end', out).id);
  return { sceneId: scene.id, cueIds };
}
