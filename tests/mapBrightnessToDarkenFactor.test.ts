import { expect, test } from 'vitest';
import { mapBrightnessToDarkenFactor } from '../src/mapBrightnessToDarkenFactor';

test('maps values from one range to another', () => {
    expect(mapBrightnessToDarkenFactor(0)).toBe(3);
    expect(mapBrightnessToDarkenFactor(0.5)).toBe(1.5);
    expect(mapBrightnessToDarkenFactor(1)).toBe(0);
    expect(mapBrightnessToDarkenFactor(0.25)).toBe(2.25);
});
