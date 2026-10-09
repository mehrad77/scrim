import { describe, expect, it } from 'vitest';
import { colorCss, fillCss, parseColor, parseFill } from './fill.js';

describe('fills', () => {
  it('reads colours with their opacity', () => {
    expect(parseColor('#fff')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(parseColor('#00000080')).toEqual({ hex: '#000000', alpha: 0.502 });
    expect(parseColor('rgba(10, 20, 30, 0.4)')).toEqual({ hex: '#0a141e', alpha: 0.4 });
    expect(parseColor('rgb(255 0 0 / 50%)')).toEqual({ hex: '#ff0000', alpha: 0.5 });
    expect(parseColor('transparent')).toEqual({ hex: '#000000', alpha: 0 });
    expect(parseColor('red')).toBeNull();
  });

  it('writes a colour as hex when opaque and rgba when not', () => {
    expect(colorCss({ hex: '#123456', alpha: 1 })).toBe('#123456');
    expect(colorCss({ hex: '#000000', alpha: 0.75 })).toBe('rgba(0, 0, 0, 0.75)');
  });

  it('round-trips a two-colour gradient', () => {
    const css = 'linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.85))';
    const fill = parseFill(css);
    expect(fill).toEqual({
      kind: 'gradient',
      angle: 180,
      from: { hex: '#000000', alpha: 0 },
      to: { hex: '#000000', alpha: 0.85 },
    });
    expect(fillCss(fill)).toBe(css);
    expect(parseFill('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)')).toMatchObject({
      kind: 'gradient',
      angle: 90,
    });
  });

  it('keeps fills it cannot edit as written', () => {
    const css = 'radial-gradient(circle, #fff, #000)';
    expect(parseFill(css)).toEqual({ kind: 'custom', css });
    expect(fillCss(parseFill(css))).toBe(css);
    expect(parseFill('transparent')).toEqual({ kind: 'none' });
  });
});
