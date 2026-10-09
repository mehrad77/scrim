import type { Show } from '@scrim/format';
import { slides, sungOrder, type Song } from '../songs.js';
import { addCue, addScene, fadeIn, fadeOut, outputOf, say, textLayer } from './common.js';

/** Most lines on screen at once; more would be too small to read from the back. */
export const MAX_LINES = 8;

export interface SongOptions {
  outputId?: string;
  /** The church or venue licence (CCLI), a setting of this machine; shown with the credit. */
  licence?: string;
  /** Lines on screen at once; longer sections continue on the next GO. */
  linesPerSlide?: number;
}

/**
 * A song as a scene: one cue per slide of each section in the order sung, each named after its
 * section so a key or a pedal can jump to the chorus, and each captioned for phones. The words
 * share one lyrics layer across songs; the credit line sits small at the bottom.
 */
export function buildSong(show: Show, song: Song, opts: SongOptions = {}) {
  const output = outputOf(show, opts.outputId);
  const lines = Math.min(MAX_LINES, Math.max(1, opts.linesPerSlide ?? 4));
  const lyrics = textLayer(show, output, 'Lyrics', [0.08, 0.2, 0.84, 0.6], {
    fontSize: Math.round(output.height / 13),
    fontWeight: 600,
  });
  // The words must fit the box: as many lines as a slide holds, with room for a line that
  // wraps. A shared layer only ever gets smaller, so earlier songs still fit too.
  const fits = Math.floor(lyrics.h / ((lines + 1) * 1.2));
  if (lyrics.fontSize > fits) lyrics.fontSize = fits;
  const credit = textLayer(show, output, 'Song credit', [0.05, 0.9, 0.9, 0.06], {
    fontSize: Math.round(output.height / 45),
    fontWeight: 400,
    color: '#bbbbbb',
  });
  const creditLine = [song.title, song.credit, opts.licence && `Licence ${opts.licence}`]
    .filter(Boolean)
    .join(' · ');
  const scene = addScene(show, song.title || 'Song');
  const cueIds: string[] = [];
  for (const section of sungOrder(song)) {
    const parts = slides(section.lines, lines);
    parts.forEach((text, i) => {
      const cue = addCue(
        show,
        scene.id,
        parts.length > 1 ? `${section.label} (${i + 1}/${parts.length})` : section.label,
        // Every slide brings the words and this song's credit up, so a jump into any section
        // (the chorus, from a fresh start or after the end) is seen.
        [
          say(lyrics.id, text),
          say(credit.id, creditLine),
          fadeIn(show, lyrics.id),
          fadeIn(show, credit.id),
        ],
        // Only a section's first slide is where a jump to it lands.
        { ...(i === 0 ? { section: section.label } : {}), access: { caption: text } },
      );
      cueIds.push(cue.id);
    });
  }
  const end = addCue(
    show,
    scene.id,
    'End of song',
    [fadeOut(show, lyrics.id), fadeOut(show, credit.id)],
    { access: { caption: '' } },
  );
  cueIds.push(end.id);
  return { sceneId: scene.id, cueIds, lyricsId: lyrics.id };
}
