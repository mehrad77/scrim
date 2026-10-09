/**
 * What a font file holds, read from its table directory without decoding it: whether it is a
 * variable font (an `fvar` table). A variable font covers every weight itself, so it must be
 * registered for the whole range, or the browser fakes bold by smearing the regular weight.
 * Reads TrueType/OpenType, WOFF and WOFF2.
 */
export function isVariableFont(buffer: ArrayBuffer): boolean {
  try {
    return tableTags(new DataView(buffer)).includes('fvar');
  } catch {
    return false;
  }
}

/** WOFF2's known table tags, by index (WOFF2 spec, table 5.1). */
const WOFF2_TAGS =
  'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'
    .match(/.{4}\s?/g)!
    .map((t) => t.slice(0, 4).trim());

function tag(view: DataView, at: number): string {
  return String.fromCharCode(
    view.getUint8(at),
    view.getUint8(at + 1),
    view.getUint8(at + 2),
    view.getUint8(at + 3),
  ).trim();
}

export function tableTags(view: DataView): string[] {
  const signature = tag(view, 0);
  if (signature === 'wOF2') return woff2Tags(view);
  if (signature === 'wOFF') {
    const n = view.getUint16(12);
    return Array.from({ length: n }, (_, i) => tag(view, 44 + i * 20));
  }
  // TrueType (0x00010000), 'OTTO' or 'true'.
  const n = view.getUint16(4);
  return Array.from({ length: n }, (_, i) => tag(view, 12 + i * 16));
}

function woff2Tags(view: DataView): string[] {
  const n = view.getUint16(12);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = view.getUint8(at++);
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('bad UIntBase128');
  };
  const tags: string[] = [];
  for (let i = 0; i < n; i++) {
    const flags = view.getUint8(at++);
    const index = flags & 0x3f;
    let name: string;
    if (index === 0x3f) {
      name = tag(view, at);
      at += 4;
    } else name = WOFF2_TAGS[index] ?? '';
    base128(); // original length
    const version = flags >> 6;
    // glyf and loca are transformed at version 0; every other table at any other version.
    const transformed = name === 'glyf' || name === 'loca' ? version === 0 : version !== 0;
    if (transformed) base128();
    tags.push(name);
  }
  return tags;
}
