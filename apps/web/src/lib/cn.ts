import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the design system's own scales (DESIGN_SYSTEM.md), or it mistakes
 * `text-caption` for a colour and drops the real colour next to it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['label', 'caption', 'ui', 'body', 'title', 'heading', 'cue', 'display'],
      spacing: ['control', 'row', 'panel-head', 'icon'],
    },
  },
});

/** Join class names; later Tailwind utilities override earlier conflicting ones. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
