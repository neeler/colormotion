import { expect, test } from 'vitest';
import { mapBrightnessToDarkenFactor } from '../src/mapBrightnessToDarkenFactor';

test('maps values from one range to another', () => {
    expect(mapBrightnessToDarkenFactor(0)).toBe(3);
    expect(mapBrightnessToDarkenFactor(1)).toBe(3);
    expect(mapBrightnessToDarkenFactor(256)).toBe(0);
    expect(mapBrightnessToDarkenFactor(255)).toBe(0);
    expect(mapBrightnessToDarkenFactor(128)).toBe(1.5);
    expect(mapBrightnessToDarkenFactor(64)).toBeCloseTo(2.255);
    expect(mapBrightnessToDarkenFactor(192)).toBeCloseTo(0.745);
});
