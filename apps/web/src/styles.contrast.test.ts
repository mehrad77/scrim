import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast guard (DESIGN_SYSTEM.md › Guards): every text, icon, line and lamp pairing the design
 * system relies on, computed from the real token file for each theme and contrast setting, plus a
 * sweep of every accent hue a person can pick. Editing a token so a pair drops below its
 * minimum fails here, not on a projector.
 */

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

type Vars = Map<string, string>;

/** Custom properties declared in blocks whose selector list matches `test`. */
function declared(test: (selectors: string[]) => boolean): Vars {
  const out: Vars = new Map();
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Drop at-rules such as @import that end before this block starts.
    const selectors = sel!
      .split(';')
      .pop()!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '));
    if (!test(selectors)) continue;
    for (const [, name, value] of body!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
      out.set(name!, value!.trim());
  }
  return out;
}

type Theme = 'booth' | 'paper';

function scope(theme: Theme, high: boolean, accentHue?: number): Vars {
  const has = (s: string) => (sels: string[]) => sels.includes(s);
  const vars: Vars = new Map([
    ...declared(has(':root')),
    ...declared((sels) => sels.some((s) => s.startsWith('@theme'))),
    ...declared(has(`[data-theme='${theme}']`)),
  ]);
  if (high) {
    for (const [k, v] of declared(has(`[data-contrast='high']`))) vars.set(k, v);
    for (const [k, v] of declared(has(`[data-theme='${theme}'][data-contrast='high']`)))
      vars.set(k, v);
  }
  if (accentHue !== undefined) vars.set('--accent-h', String(accentHue));
  return vars;
}

function resolve(value: string, vars: Vars, depth = 0): string {
  if (depth > 20) throw new Error(`var() loop in ${value}`);
  let out = value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const v = vars.get(name);
    if (v === undefined) throw new Error(`Undefined ${name}`);
    return resolve(v, vars, depth + 1);
  });
  out = out.replace(/calc\(\s*([\d.]+)\s*([-+*/])\s*([\d.]+)\s*\)/g, (_, a, op, b) => {
    const [x, y] = [Number(a), Number(b)];
    return String(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : x / y);
  });
  return out;
}

type Lab = [number, number, number];

function parseColor(c: string): Lab {
  const mix = /^color-mix\(in oklab,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/.exec(c);
  if (mix) {
    const a = parseColor(mix[1]!);
    const b = parseColor(mix[3]!);
    const p = Number(mix[2]) / 100;
    return [0, 1, 2].map((i) => a[i]! * p + b[i]! * (1 - p)) as Lab;
  }
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c);
  if (!m) throw new Error(`Not a colour: ${c}`);
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  return [L, C * Math.cos(H), C * Math.sin(H)];
}

/** OKLab to relative luminance, through linear sRGB clamped to the gamut. */
function luminance([L, a, b]: Lab): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

function contrast(fg: string, bg: string, vars: Vars): number {
  const [x, y] = [fg, bg]
    .map((role) => luminance(parseColor(resolve(`var(--${role})`, vars))))
    .sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** [foreground role, background role, minimum ratio] */
type Pair = [string, string, number];

const BOOTH: Pair[] = [
  ['fg', 'surface-app', 12],
  ['fg', 'surface-panel', 12],
  ['fg', 'surface-overlay', 12],
  ['fg-muted', 'surface-panel', 7],
  ['fg-muted', 'surface-overlay', 7],
  ['fg-subtle', 'surface-panel', 4.5],
  ['fg-subtle', 'surface-control-active', 4.5],
  ['fg-subtle', 'surface-overlay', 4.5],
  ['fg-icon', 'surface-panel', 3],
  ['fg-icon', 'surface-control-hover', 3],
  ['fg-icon', 'surface-overlay', 3],
  ['line-control', 'surface-panel', 3],
  ['line-control', 'surface-control', 3],
  ['line-control', 'surface-raised', 3],
  ['line-control', 'surface-overlay', 3],
  ['focus', 'surface-app', 3],
  ['accent-text', 'surface-panel', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['accent-fg', 'accent-hover', 4.5],
  ['accent', 'surface-panel', 3],
  ['fg-on-lamp', 'lamp-go', 4.5],
  ['fg-on-lamp', 'lamp-standby', 4.5],
  ['fg-on-fault', 'lamp-fault', 4.5],
  ['lamp-go', 'surface-panel', 3],
  ['lamp-fault', 'surface-panel', 3],
  ['fg-go', 'surface-panel', 4.5],
  ['fg-standby', 'surface-panel', 4.5],
  ['fg-fault', 'surface-panel', 4.5],
  ['fg-warn', 'surface-panel', 4.5],
  ['fg-info', 'surface-panel', 4.5],
  ['color-tape-1', 'surface-panel', 3],
  ['color-tape-6', 'surface-panel', 3],
  ['fg-on-lamp', 'color-tape-7', 4.5],
  ['fg-go', 'lamp-go-tint', 4.5],
  ['fg-standby', 'lamp-standby-tint', 4.5],
  ['fg', 'lamp-standby-tint', 7],
  // The Rehearsal bar: app-coloured text on an fg bar.
  ['surface-app', 'fg', 7],
];

const PAPER: Pair[] = [
  ['fg', 'surface-app', 12],
  ['fg', 'surface-panel', 12],
  ['fg-muted', 'surface-panel', 7],
  ['fg-muted', 'surface-control-active', 6],
  ['fg-subtle', 'surface-panel', 4.5],
  ['fg-subtle', 'surface-control', 4.5],
  ['fg-icon', 'surface-panel', 3],
  ['line-control', 'surface-panel', 3],
  ['line-control', 'surface-app', 3],
  ['focus', 'surface-panel', 3],
  ['accent-text', 'surface-panel', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['accent-fg', 'accent-hover', 4.5],
  ['fg-on-lamp', 'lamp-go', 4.5],
  ['fg-on-lamp', 'lamp-standby', 4.5],
  ['fg-on-fault', 'lamp-fault', 4.5],
  ['fg-go', 'surface-panel', 4.5],
  ['fg-standby', 'surface-panel', 4.5],
  ['fg-fault', 'surface-panel', 4.5],
  ['fg-warn', 'surface-panel', 4.5],
  ['fg-info', 'surface-panel', 4.5],
  ['color-tape-1', 'surface-panel', 3],
  ['color-tape-3', 'surface-panel', 3],
  ['color-tape-6', 'surface-panel', 3],
  ['fg-go', 'lamp-go-tint', 4.5],
  // GO's border is `border-go` (fg-go); Paper lamps carry a line-control border instead.
  ['fg-go', 'surface-panel', 3],
  ['fg-standby', 'lamp-standby-tint', 4.5],
  ['fg', 'lamp-standby-tint', 7],
  ['surface-app', 'fg', 7],
];

const HIGH: [Theme, ...Pair][] = [
  ['booth', 'fg-subtle', 'surface-panel', 7],
  ['booth', 'line-control', 'surface-panel', 4],
  ['paper', 'fg-subtle', 'surface-panel', 7],
  ['paper', 'line-control', 'surface-panel', 3.5],
];

describe('token contrast', () => {
  const cases = [
    ...BOOTH.map((p) => ['booth', false, ...p] as const),
    ...PAPER.map((p) => ['paper', false, ...p] as const),
    ...HIGH.map(([t, ...p]) => [t, true, ...p] as const),
  ];
  it.each(cases)('%s (high: %s): %s on %s ≥ %d', (theme, high, fg, bg, min) => {
    expect(contrast(fg, bg, scope(theme, high))).toBeGreaterThanOrEqual(min);
  });

  it('every accent hue a person can pick keeps its contrast in both themes', () => {
    const failures: string[] = [];
    // Preferences offers 50–355°; 355–50 is skipped so the accent never reads as fault or warn.
    for (let h = 50; h <= 355; h += 5) {
      for (const theme of ['booth', 'paper'] as const) {
        const vars = scope(theme, false, h);
        for (const [fg, bg] of [
          ['accent-text', 'surface-panel'],
          ['accent-fg', 'accent'],
        ] as const) {
          const r = contrast(fg, bg, vars);
          if (r < 4.5) failures.push(`${theme} h${h} ${fg} on ${bg}: ${r.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
