import { bench, describe } from 'vitest';
import { Theme } from '../../src';
import { DUSK, GOLD, MODES, STEP_COUNTS, inTransition } from './fixtures';

describe('Theme construction', () => {
    for (const nSteps of STEP_COUNTS) {
        bench(`oklch, ${nSteps} steps`, () => {
            new Theme({ colors: GOLD, mode: 'oklch', nSteps });
        });
    }
});

describe('getColor', () => {
    const plain = new Theme({ colors: GOLD, nSteps: 2048 });
    const linear = new Theme({
        colors: GOLD,
        nSteps: 2048,
        brightnessMode: 'linear',
    });
    let i = 0;
    bench('full brightness', () => {
        plain.getColor(i++);
    });
    bench('brightness 0.5, darken', () => {
        plain.getColor(i++, { brightness: 0.5 });
    });
    bench('brightness 0.5, linear', () => {
        linear.getColor(i++, { brightness: 0.5 });
    });
    bench('full brightness + rgb()', () => {
        plain.getColor(i++).rgb();
    });
});

// One tick of a palette transition in progress: the per-frame cost while a theme is changing.
describe('transition tick', () => {
    for (const nSteps of STEP_COUNTS) {
        for (const mode of MODES) {
            const t = inTransition(() => {
                const theme = new Theme({ colors: GOLD, mode, nSteps });
                theme.update({ colors: DUSK, transitionSpeed: 0.01 });
                return theme;
            });
            bench(
                `${mode}, ${nSteps} steps`,
                () => (t.get() as Theme).tick(),
                t.options,
            );
        }
    }
});

// A whole transition from start to finish at the default speed.
describe('full transition', () => {
    for (const nSteps of STEP_COUNTS) {
        bench(
            `oklch, ${nSteps} steps, default speed`,
            () => {
                const theme = new Theme({
                    colors: GOLD,
                    mode: 'oklch',
                    nSteps,
                });
                theme.update({ colors: DUSK });
                while (theme.targetPalette) {
                    theme.tick();
                }
            },
            { time: 0, iterations: 3, warmupIterations: 0 },
        );
    }
});

describe('tick without a transition', () => {
    const theme = new Theme({ colors: GOLD, nSteps: 2048 });
    bench('rotate only', () => {
        theme.tick();
    });
});
