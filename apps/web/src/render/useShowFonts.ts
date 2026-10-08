import type { Media, Show } from '@scrim/format';
import { useEffect, useState } from 'react';
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
          const face = new FontFace(fontFamilyOf(m), await file.arrayBuffer());
          document.fonts.add(await face.load());
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
