import { expect, test } from 'vitest';
import { sameOrder } from '../src/sameOrder';

test('compares positions in order', () => {
    expect(sameOrder([], [])).toBe(true);
    expect(sameOrder([0, 1, 2], [0, 1, 2])).toBe(true);
    expect(sameOrder([0, 1, 2], [1, 2, 0])).toBe(false);
    expect(sameOrder([0, 1], [0, 1, 2])).toBe(false);
    expect(sameOrder([0, 1, 2], [0, 1])).toBe(false);
});
