import type { Media, Show } from '@scrim/format';
import { useEffect, useState } from 'react';
import { isVariableFont } from '../lib/fontInfo.js';
import { mediaFile } from '../storage/media.js';

/** The CSS family a show font is registered under: its file name without the extension. */
export function fontFamilyOf(media: Pick<Media, 'name'>): string {
  return media.name.replace(/\.[^.]+$/, '');
}

const loaded = new Map<string, Promise<void>>();

/**
 * Register the show's own font files with the document, so text layers render with them on any
 * machine, offline (they travel in the .scrim bundle). Returns how many have loaded.
 */
export function useShowFonts(show: Show): number {
  const fonts = show.media.filter((m) => m.kind === 'font');
  const key = fonts.map((m) => m.id).join(',');
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let alive = true;
    for (const m of fonts) {
      let p = loaded.get(m.id);
      if (!p) {
        p = mediaFile(m.id).then(async (file) => {
          if (!file) return;
          const data = await file.arrayBuffer();
          for (const [family, descriptors] of faces(m, data))
            document.fonts.add(await new FontFace(family, data, descriptors).load());
        });
        loaded.set(
          m.id,
          p.catch(() => undefined),
        );
      }
      void p.then(() => alive && setReady((n) => n + 1));
    }
    return () => {
      alive = false;
    };
    // `key` stands for the list of font ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

/**
 * The faces one font file provides. A variable font covers every weight, so it is registered for
 * the whole range (otherwise bold would be faked). A file named "Family-Italic" (or "Family
 * Italic") is also the italic of "Family", so italic text in that family uses the real letters.
 */
export function faces(
  media: Pick<Media, 'name'>,
  data: ArrayBuffer,
): [string, FontFaceDescriptors][] {
  const family = fontFamilyOf(media);
  const weight: FontFaceDescriptors = isVariableFont(data) ? { weight: '1 1000' } : {};
  const out: [string, FontFaceDescriptors][] = [[family, weight]];
  const base = /^(.+?)[-_ ]Italic$/i.exec(family)?.[1];
  if (base) out.push([base, { ...weight, style: 'italic' }]);
  return out;
}
