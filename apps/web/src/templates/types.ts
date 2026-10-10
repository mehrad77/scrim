import type { Media, Show } from '@scrim/format';
import type { LearnSpec } from '../lib/learn.js';

/** Who a template is for: the gallery's groups. */
export type TemplateGroup = 'schools' | 'gatherings' | 'care' | 'museums' | 'family' | 'music';

export const GROUPS: { id: TemplateGroup; title: string }[] = [
  { id: 'schools', title: 'Schools' },
  { id: 'gatherings', title: 'Gatherings' },
  { id: 'care', title: 'Care' },
  { id: 'museums', title: 'Museums' },
  { id: 'family', title: 'Family & friends' },
  { id: 'music', title: 'Music' },
];

/** A file the template uses, by its path under public/templates/ (see index.json). */
export interface AssetSpec {
  key: string;
  path: string;
}

/** The media a template asked for, stored on this machine, by asset key. */
export type TemplateMedia = Record<string, Media>;

/**
 * A starting show for one kind of user (docs/templates.md). `make` is pure: given the stored
 * media it builds the whole show, so it can be tested without a browser.
 */
export interface TemplateSeed {
  id: string;
  title: string;
  group: TemplateGroup;
  /** Who picks it, in a line: "A teacher putting on a class play". */
  forWho: string;
  /** What it does for them, in a sentence. */
  blurb: string;
  /** What they'll need in the room. */
  needs: string[];
  /** What they swap for their own. */
  replace: string[];
  /** What it doesn't do yet, said plainly. */
  limits: string[];
  assets: AssetSpec[];
  learn: LearnSpec[];
  /**
   * The cues whose stage is each scene's deliberate composition, by name, for the contact sheet;
   * the first is the gallery thumbnail. Absent: the last cue of each scene.
   */
  heroes?: string[];
  /**
   * Moments that are games rather than choices (a guess, a tap race): every answer may lead to
   * the same next scene. Any other vote must branch.
   */
  games?: string[];
  /** The visual bar this template holds itself to (templates.test.ts). */
  visual: {
    /** Smallest text the audience reads, in output pixels. */
    minText: number;
    /** Text on a solid backing contrasts at least this much. */
    minContrast: number;
    /** Layers allowed to be smaller, down to LABEL_MIN: wall labels, credit lines. */
    labels?: string[];
  };
  make(media: TemplateMedia): Show;
}

export const thumbnailOf = (seed: Pick<TemplateSeed, 'id'>) => `templates/${seed.id}/thumb.webp`;
