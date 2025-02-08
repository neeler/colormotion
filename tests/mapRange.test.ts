import { expect, test } from 'vitest';
import { mapRange } from '../src/mapRange';

test('returns a function', () => {
    const mapper = mapRange({
        inRange: [0, 1],
        outRange: [0, 1],
    });
    expect(typeof mapper).toBe('function');
});

test('maps values from one range to another', () => {
    const mapper = mapRange({
        inRange: [0, 1],
        outRange: [0, 2],
    });

    expect(mapper(0)).toBe(0);
    expect(mapper(0.5)).toBe(1);
    expect(mapper(1)).toBe(2);

    const mapper2 = mapRange({
        inRange: [0, 1],
        outRange: [0, 3],
    });

    expect(mapper2(0)).toBe(0);
    expect(mapper2(0.5)).toBe(1.5);
    expect(mapper2(1)).toBe(3);

    const negativeMapper = mapRange({
        inRange: [-1, 1],
        outRange: [0, 1],
    });

    expect(negativeMapper(-1)).toBe(0);
    expect(negativeMapper(0)).toBe(0.5);
    expect(negativeMapper(1)).toBe(1);
});

test('clamps values outside of range', () => {
    const mapper = mapRange({
        inRange: [0, 1],
        outRange: [0, 1],
    });

    expect(mapper(-1)).toBe(0);
    expect(mapper(2)).toBe(1);
});
