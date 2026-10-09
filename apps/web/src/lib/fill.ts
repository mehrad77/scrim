/**
 * Fills are CSS backgrounds. The inspector edits the forms it can show: nothing, one colour, or
 * a straight two-colour gradient, each colour with its opacity. Anything else (a radial gradient,
 * more stops) is kept as written and shown as a custom fill.
 */
export interface Stop {
  /** #rrggbb */
  hex: string;
  /** 0–1 */
  alpha: number;
}

export type Fill =
  | { kind: 'none' }
  | { kind: 'solid'; color: Stop }
  | { kind: 'gradient'; angle: number; from: Stop; to: Stop }
  | { kind: 'custom'; css: string };

const COLOR = String.raw`#[0-9a-f]{3,8}|rgba?\([^)]*\)|transparent`;
const GRADIENT = new RegExp(
  String.raw`^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(${COLOR})(?:\s+0%)?\s*,\s*(${COLOR})(?:\s+100%)?\s*\)$`,
  'i',
);

export function parseColor(css: string): Stop | null {
  const s = css.trim().toLowerCase();
  if (s === 'transparent') return { hex: '#000000', alpha: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const alpha = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return { hex: `#${h.slice(0, 6)}`, alpha: round(alpha) };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(+v!))));
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
  return {
    hex: `#${[r!, g!, b!].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    alpha: round(a),
  };
}

export function colorCss({ hex, alpha }: Stop): string {
  if (alpha >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${round(alpha)})`;
}

export function parseFill(css: string): Fill {
  const s = css.trim();
  if (!s || s === 'transparent' || s === 'none') return { kind: 'none' };
  const solid = parseColor(s);
  if (solid) return { kind: 'solid', color: solid };
  const m = GRADIENT.exec(s);
  const from = m && parseColor(m[2]!);
  const to = m && parseColor(m[3]!);
  if (m && from && to) return { kind: 'gradient', angle: ((+m[1]! % 360) + 360) % 360, from, to };
  return { kind: 'custom', css: s };
}

export function fillCss(fill: Fill): string {
  switch (fill.kind) {
    case 'none':
      return 'transparent';
    case 'solid':
      return colorCss(fill.color);
    case 'gradient':
      return `linear-gradient(${fill.angle}deg, ${colorCss(fill.from)}, ${colorCss(fill.to)})`;
    case 'custom':
      return fill.css;
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
