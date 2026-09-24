import { bench, describe } from 'vitest';
import { ColorPalette } from '../../src';
import { GOLD, MODES, STEP_COUNTS, seeded } from './fixtures';

// Building a palette's scale runs on every palette change (update, randomize, push, rotate).
describe('ColorPalette construction', () => {
    for (const nSteps of STEP_COUNTS) {
        for (const mode of MODES) {
            bench(`${mode}, ${nSteps} steps`, () => {
                new ColorPalette({ colors: GOLD, mode, nSteps });
            });
        }
    }
});

// Random palettes draw candidates until one is deltaEThreshold away from the previous color.
describe('ColorPalette.random', () => {
    for (const nColors of [5, 8]) {
        const random = seeded(1);
        bench(`${nColors} colors, 2048 steps`, () => {
            ColorPalette.random({ nColors, mode: 'rgb', nSteps: 2048, random });
        });
    }
    const strict = seeded(2);
    bench('5 colors, strict deltaE (40)', () => {
        ColorPalette.random({
            nColors: 5,
            mode: 'rgb',
            nSteps: 256,
            deltaEThreshold: 40,
            random: strict,
        });
    });
});
