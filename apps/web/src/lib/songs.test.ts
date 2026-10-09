import { describe, expect, it } from 'vitest';
import {
  arrangementText,
  lyricsText,
  newSong,
  parseArrangement,
  parseLyrics,
  readSongsFile,
  slides,
  songsFile,
  sungOrder,
} from './songs.js';

const GRACE = `Amazing grace, how sweet the sound
That saved a wretch like me

Chorus
Praise, praise, praise the Lord

'Twas grace that taught my heart to fear
And grace my fears relieved

Praise, praise, praise the Lord

[Bridge]
Through many dangers, toils and snares

Chorus`;

describe('songs', () => {
  it('splits lyrics into named sections and keeps the order they were written in', () => {
    const { sections, order } = parseLyrics(GRACE);
    expect(sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Bridge']);
    expect(sections[1]!.lines).toBe('Praise, praise, praise the Lord');
    // The chorus written out again, and named on its own, are the chorus sung again.
    expect(order).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus']);
    const song = newSong('Amazing Grace', GRACE, 'John Newton');
    expect(sungOrder(song).map((s) => s.label)).toEqual(order);
  });

  it('reads short arrangements, and keeps a song written once through as it is', () => {
    const song = newSong('Plain', 'One\n\nTwo');
    expect(song.arrangement).toEqual([]);
    expect(sungOrder(song).map((s) => s.label)).toEqual(['Verse 1', 'Verse 2']);
    const { sections } = parseLyrics(GRACE);
    expect(parseArrangement('V1 C v2 c B C', sections)).toEqual([
      'Verse 1',
      'Chorus',
      'Verse 2',
      'Chorus',
      'Bridge',
      'Chorus',
    ]);
  });

  it('splits long sections into even slides', () => {
    expect(slides('a\nb\nc\nd\ne', 4)).toEqual(['a\nb\nc', 'd\ne']);
    expect(slides('a\nb', 4)).toEqual(['a\nb']);
  });

  it('numbers a second, different section under the same name', () => {
    const { sections } = parseLyrics('Chorus\nOne\n\nChorus\nTwo');
    expect(sections.map((s) => s.label)).toEqual(['Chorus', 'Chorus (2)']);
  });

  it('round-trips a songs file with fresh ids, and refuses other files', () => {
    const song = newSong('Amazing Grace', GRACE, 'John Newton');
    const [back] = readSongsFile(songsFile([song]));
    expect(back).toMatchObject({ title: 'Amazing Grace', credit: 'John Newton' });
    expect(back!.id).not.toBe(song.id);
    expect(back!.sections).toEqual(song.sections);
    expect(lyricsText(song)).toContain('Bridge\nThrough many dangers');
    expect(() => readSongsFile('{"format":"scrim-show"}')).toThrow('not a Scrim songs file');
  });

  it('reads its own order and words back the same, so a kept song never changes', () => {
    const song = newSong(
      'Odd',
      '[Hook]\nabc\n\nVerse 1\none\n\nVerse 1\nother\n\n[Instrumental]\nghi\n\n[Hook]',
    );
    const again = parseLyrics(lyricsText(song));
    expect(again.sections).toEqual(song.sections);
    expect(song.sections.map((s) => s.label)).toEqual([
      'Hook',
      'Verse 1',
      'Verse 1 (2)',
      'Instrumental',
    ]);
    const grace = newSong('Amazing Grace', GRACE);
    expect(parseArrangement(arrangementText(grace.arrangement), grace.sections)).toEqual(
      grace.arrangement,
    );
    // Full names without commas, and typos left out.
    expect(parseArrangement('Verse 1 Chorus Verse 2 Chorsu Bridge', grace.sections)).toEqual([
      'Verse 1',
      'Chorus',
      'Verse 2',
      'Bridge',
    ]);
  });
});
