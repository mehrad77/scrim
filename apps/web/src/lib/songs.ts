import { uid } from '@scrim/format';

/**
 * Songs for lyrics on stage (users-and-journey › faith and community, gigs): words split into
 * labelled sections, and the order they are sung in. Kept in a library on this machine, so a
 * song typed once is reused across shows.
 */
export interface Song {
  id: string;
  title: string;
  /** Who wrote it and the song's licence number, shown small under the words. */
  credit: string;
  /** In the order written; labels like Verse 1, Chorus, Bridge. */
  sections: SongSection[];
  /** The order sung, by label; empty: as written. */
  arrangement: string[];
  updatedAt: number;
}

export interface SongSection {
  label: string;
  lines: string;
}

const KNOWN =
  /^\[?\s*(verse|chorus|refrain|pre-?chorus|bridge|tag|intro|outro|ending|coda|interlude)\s*(\d+)?\s*\]?\s*:?\s*$/i;
const BRACKETED = /^\[\s*([^\]]+?)\s*\]$/;

const NAMES: Record<string, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  refrain: 'Refrain',
  prechorus: 'Pre-chorus',
  'pre-chorus': 'Pre-chorus',
  bridge: 'Bridge',
  tag: 'Tag',
  intro: 'Intro',
  outro: 'Outro',
  ending: 'Ending',
  coda: 'Coda',
  interlude: 'Interlude',
};

/** "[Chorus]", "Verse 2:" or "bridge" as a section label; null when the line is lyrics. */
function labelOf(line: string): string | null {
  const known = KNOWN.exec(line.trim());
  if (known) {
    const name = NAMES[known[1]!.toLowerCase()] ?? known[1]!;
    return known[2] ? `${name} ${known[2]}` : name;
  }
  return BRACKETED.exec(line.trim())?.[1] ?? null;
}

/**
 * Pasted lyrics as sections, and the order they were written in. Blank lines separate sections;
 * a first line such as "Chorus" or "[Verse 2]" names one, and a name on its own repeats that
 * section. An unnamed section with an earlier one's words is that section again (a chorus
 * written out each time); other unnamed ones are numbered verses.
 */
export function parseLyrics(text: string): { sections: SongSection[]; order: string[] } {
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trimEnd()))
    .filter((lines) => lines.some((l) => l.trim()));
  const sections: SongSection[] = [];
  const order: string[] = [];
  let verses = 0;
  for (const lines of blocks) {
    const named = labelOf(lines[0]!);
    const body = (named ? lines.slice(1) : lines).join('\n').trim();
    const known = sections.find((x) => (named ? x.label === named : x.lines === body));
    if (known && (!body || known.lines === body)) {
      order.push(known.label);
      continue;
    }
    if (!body) continue;
    let label = named ?? `Verse ${++verses}`;
    if (named && /^Verse \d+$/.test(named)) verses = Math.max(verses, Number(named.slice(6)));
    // Two different sections under one name: keep both, numbered.
    if (sections.some((x) => x.label === label)) {
      let n = 2;
      while (sections.some((x) => x.label === `${label} (${n})`)) n++;
      label = `${label} (${n})`;
    }
    sections.push({ label, lines: body });
    order.push(label);
  }
  return { sections, order };
}

/** The sections in the order sung: the arrangement, else every section as written. */
export function sungOrder(song: Pick<Song, 'sections' | 'arrangement'>): SongSection[] {
  const byLabel = new Map(song.sections.map((s) => [s.label.toLowerCase(), s]));
  const order = song.arrangement
    .map((a) => byLabel.get(resolveLabel(a, song.sections).toLowerCase()))
    .filter((s): s is SongSection => !!s);
  return order.length ? order : song.sections;
}

const SHORT: Record<string, string> = {
  v: 'Verse',
  c: 'Chorus',
  r: 'Refrain',
  pc: 'Pre-chorus',
  p: 'Pre-chorus',
  b: 'Bridge',
  t: 'Tag',
  i: 'Intro',
  o: 'Outro',
  e: 'Ending',
};

/** "V1", "c", "Bridge" as one of the song's labels, as near as can be found. */
function resolveLabel(token: string, sections: SongSection[]): string {
  const t = token.trim();
  const exact = sections.find((s) => s.label.toLowerCase() === t.toLowerCase());
  if (exact) return exact.label;
  const m = /^([a-z-]+)\s*(\d*)$/i.exec(t);
  if (!m) return t;
  const name = SHORT[m[1]!.toLowerCase()] ?? NAMES[m[1]!.toLowerCase()] ?? m[1]!;
  const full = m[2] ? `${name} ${m[2]}` : name;
  // "C" for a song whose only chorus is "Chorus 1", and "V" for its first verse.
  return (
    sections.find((s) => s.label.toLowerCase() === full.toLowerCase())?.label ??
    sections.find((s) => s.label.toLowerCase().startsWith(name.toLowerCase()))?.label ??
    full
  );
}

/**
 * "V1 C V2 C B C", "Verse 1, Chorus, Verse 2" or "Verse 1 Chorus Bridge" as labels of the
 * song's sections. Commas, when there are any, separate names; otherwise the song's own labels
 * are matched longest first ("Verse 2" is one name, not two). Names that match no section are
 * left out, so a typo never lands in the song.
 */
export function parseArrangement(text: string, sections: SongSection[]): string[] {
  const known = new Set(sections.map((s) => s.label.toLowerCase()));
  const tokens: string[] = [];
  if (text.includes(',')) tokens.push(...text.split(',').map((t) => t.trim()));
  else {
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length;) {
      let taken = 1;
      for (let n = Math.min(4, words.length - i); n > 1; n--)
        if (
          known.has(
            words
              .slice(i, i + n)
              .join(' ')
              .toLowerCase(),
          )
        ) {
          taken = n;
          break;
        }
      // "Verse 2", "V 2": a name and its number are one.
      if (taken === 1 && /^\d+$/.test(words[i + 1] ?? '') && /^[a-z-]+$/i.test(words[i]!))
        taken = 2;
      tokens.push(words.slice(i, i + taken).join(' '));
      i += taken;
    }
  }
  return tokens
    .filter(Boolean)
    .map((t) => resolveLabel(t, sections))
    .filter((l) => known.has(l.toLowerCase()));
}

/** The order sung as text the wizard shows, and reads back the same. */
export const arrangementText = (labels: string[]) => labels.join(', ');

/** Split a section into slides of at most `max` lines, so long verses stay readable. */
export function slides(lines: string, max: number): string[] {
  const all = lines.split('\n');
  if (max <= 0 || all.length <= max) return [lines];
  // Even slides read better than a long one and a short leftover.
  const count = Math.ceil(all.length / max);
  const size = Math.ceil(all.length / count);
  const out: string[] = [];
  for (let i = 0; i < all.length; i += size) out.push(all.slice(i, i + size).join('\n'));
  return out;
}

export function newSong(title: string, lyrics: string, credit = ''): Song {
  const { sections, order } = parseLyrics(lyrics);
  // As written is the arrangement, unless it is just each section once.
  const plain = order.length === sections.length && order.every((l, i) => sections[i]!.label === l);
  return {
    id: uid('song'),
    title,
    credit,
    sections,
    arrangement: plain ? [] : order,
    updatedAt: Date.now(),
  };
}

/** The lyrics as they would be pasted back: each section under its label. */
export function lyricsText(song: Pick<Song, 'sections'>): string {
  // A name the parser wouldn't know on its own line is written in brackets, so it reads back.
  const named = (label: string) => (labelOf(label) === label ? label : `[${label}]`);
  return song.sections.map((s) => `${named(s.label)}\n${s.lines}`).join('\n\n');
}

/** Songs as a file to share: `{ format: 'scrim-songs', version: 1, songs }`. */
export function songsFile(songs: Song[]): string {
  return JSON.stringify({ format: 'scrim-songs', version: 1, songs }, null, 2);
}

/** Read a songs file; each song gets a fresh id so it can't overwrite one already kept. */
export function readSongsFile(text: string): Song[] {
  const data = JSON.parse(text) as { format?: string; songs?: unknown };
  if (data.format !== 'scrim-songs' || !Array.isArray(data.songs))
    throw new Error('This is not a Scrim songs file');
  return data.songs.flatMap((raw) => {
    const s = raw as Partial<Song>;
    if (typeof s.title !== 'string' || !Array.isArray(s.sections)) return [];
    const sections = s.sections.filter(
      (x): x is SongSection => typeof x?.label === 'string' && typeof x?.lines === 'string',
    );
    return [
      {
        id: uid('song'),
        title: s.title,
        credit: typeof s.credit === 'string' ? s.credit : '',
        sections,
        arrangement: Array.isArray(s.arrangement)
          ? s.arrangement.filter((a): a is string => typeof a === 'string')
          : [],
        updatedAt: Date.now(),
      },
    ];
  });
}
