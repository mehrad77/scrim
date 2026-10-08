import { describe, expect, it } from 'vitest';
import { evaluateNumber } from './Field.js';

describe('evaluateNumber', () => {
  it('reads plain numbers and arithmetic', () => {
    expect(evaluateNumber('42', 0)).toBe(42);
    expect(evaluateNumber('-5', 10)).toBe(-5);
    expect(evaluateNumber('(100/2)+6', 0)).toBe(56);
  });
  it('applies +, * and / to the current value', () => {
    expect(evaluateNumber('+10', 5)).toBe(15);
    expect(evaluateNumber('*2', 7)).toBe(14);
    expect(evaluateNumber('/4', 20)).toBe(5);
  });
  it('rejects anything that is not arithmetic', () => {
    expect(evaluateNumber('alert(1)', 0)).toBeNull();
    expect(evaluateNumber('', 0)).toBeNull();
    expect(evaluateNumber('1/0', 0)).toBeNull();
  });
});
