import { expect, test } from 'vitest';
import { safeMod } from '../src/safeMod';

test('safely performs modulo', () => {
    expect(safeMod(5, 3)).toBe(2);
    expect(safeMod(5, 5)).toBe(0);
    expect(safeMod(5, 1)).toBe(0);
    expect(safeMod(5, 0)).toBe(NaN);
    expect(safeMod(0, 5)).toBe(0);
    expect(safeMod(0, 0)).toBe(NaN);
    expect(safeMod(-5, 3)).toBe(1);
    expect(safeMod(-5, 5)).toBe(0);
    expect(safeMod(-5, 1)).toBe(0);
    expect(safeMod(-5, 0)).toBe(NaN);
    expect(safeMod(5, -3)).toBe(-1);
    expect(safeMod(5, -5) === 0).toBe(true);
    expect(safeMod(5, -1) === 0).toBe(true);
    expect(safeMod(-5, -3)).toBe(-2);
    expect(safeMod(-5, -5) === 0).toBe(true);
    expect(safeMod(-5, -1) === 0).toBe(true);
    expect(safeMod(0, -3) === 0).toBe(true);
    expect(safeMod(0, -5) === 0).toBe(true);
    expect(safeMod(0, -1) === 0).toBe(true);
});
