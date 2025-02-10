import { expect, test } from 'vitest';
import { clamp } from '../src/clamp';

test('clamps values outside of range', () => {
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(1, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
});

test('handles swapped range', () => {
    expect(clamp(0, 1, 0)).toBe(0);
    expect(clamp(0.5, 1, 0)).toBe(0.5);
    expect(clamp(1, 1, 0)).toBe(1);
    expect(clamp(-1, 1, 0)).toBe(0);
    expect(clamp(2, 1, 0)).toBe(1);
});
