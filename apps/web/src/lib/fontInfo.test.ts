import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isVariableFont, tableTags } from './fontInfo.js';

const font = (name: string) => {
  const b = readFileSync(new URL(`../../public/fonts/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe('font files', () => {
  it('reads the table directory of a WOFF2 file', () => {
    const tags = tableTags(new DataView(font('IBMPlexMono-400-Latin.woff2')));
    expect(tags).toEqual(expect.arrayContaining(['cmap', 'head', 'name']));
  });

  it('tells a variable font from a static one', () => {
    expect(isVariableFont(font('FrauncesVar-Latin.woff2'))).toBe(true);
    expect(isVariableFont(font('IBMPlexSansVar-Latin.woff2'))).toBe(true);
    expect(isVariableFont(font('IBMPlexMono-400-Latin.woff2'))).toBe(false);
  });

  it('says no to something that is not a font', () => {
    expect(isVariableFont(new Uint8Array([1, 2, 3]).buffer)).toBe(false);
  });
});
