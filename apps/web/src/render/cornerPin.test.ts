import { describe, expect, it } from 'vitest';
import { cornerPinMatrix, hasPin } from './cornerPin.js';

const zero = { x: 0, y: 0 };

function apply(matrix: string, x: number, y: number): [number, number] {
  const m = matrix.slice('matrix3d('.length, -1).split(',').map(Number);
  const w = m[3]! * x + m[7]! * y + m[15]!;
  return [(m[0]! * x + m[4]! * y + m[12]!) / w, (m[1]! * x + m[5]! * y + m[13]!) / w];
}

describe('cornerPinMatrix', () => {
  it('maps the corners onto the pinned points', () => {
    const pin: Parameters<typeof cornerPinMatrix>[2] = [
      { x: 10, y: 5 },
      { x: -20, y: 0 },
      zero,
      { x: 30, y: -15 },
    ];
    const m = cornerPinMatrix(1920, 1080, pin);
    const corners: [number, number][] = [
      [0, 0],
      [1920, 0],
      [1920, 1080],
      [0, 1080],
    ];
    corners.forEach(([x, y], i) => {
      const [px, py] = apply(m, x, y);
      expect(px).toBeCloseTo(x + pin[i]!.x, 3);
      expect(py).toBeCloseTo(y + pin[i]!.y, 3);
    });
  });

  it('is the identity with no offsets', () => {
    expect(apply(cornerPinMatrix(100, 50, [zero, zero, zero, zero]), 37, 12)).toEqual([37, 12]);
    expect(hasPin([zero, zero, zero, zero])).toBe(false);
    expect(hasPin(undefined)).toBe(false);
  });
});
