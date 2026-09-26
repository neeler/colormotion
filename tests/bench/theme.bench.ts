import { bench, describe } from 'vitest';
import { InterpolationMode, Theme } from '../../src';
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

// Sampling the whole scale into a float lookup table, as an LED engine does on every frame: a getColor loop
// (channels over 255) against fillRgb. Each iteration ticks first, so a transition's colors are new each time.
describe('scale into a Float32Array, 256 steps', () => {
    const nSteps = 256;
    const lut = new Float32Array(nSteps * 3);
    const getColorLoop = (theme: Theme, brightness?: number) => {
        for (let i = 0; i < nSteps; i++) {
            const [r, g, b] = theme.getColor(i, { brightness }).rgb(false);
            lut[i * 3] = r! / 255;
            lut[i * 3 + 1] = g! / 255;
            lut[i * 3 + 2] = b! / 255;
        }
    };
    const fill = (theme: Theme, brightness?: number) =>
        theme.fillRgb(lut, { brightness });
    const make = (mode: InterpolationMode) =>
        new Theme({ colors: GOLD, mode, nSteps, brightnessMode: 'linear' });

    for (const mode of ['rgb', 'oklch'] as const) {
        for (const [name, read] of [
            ['getColor loop', getColorLoop],
            ['fillRgb', fill],
        ] as const) {
            const steady = make(mode);
            bench(`${mode}, at rest, ${name}`, () => {
                steady.tick();
                read(steady);
            });

            const t = inTransition(() => {
                const theme = make(mode);
                theme.update({ colors: DUSK, transitionDuration: 100_000 });
                return theme;
            });
            bench(
                `${mode}, transitioning, ${name}`,
                () => {
                    const theme = t.get() as Theme;
                    theme.tick();
                    read(theme);
                },
                // a timed transition this long outlasts more iterations, and a fill needs them to warm up
                { ...t.options, iterations: 3000, warmupIterations: 1000 },
            );
        }
    }

    // 'darken' mode (the default), with a brightness option that changes on every call, as in a fade: the fill
    // darkens every color again each time
    for (const [name, read] of [
        ['getColor loop', getColorLoop],
        ['fillRgb', fill],
    ] as const) {
        const theme = new Theme({ colors: GOLD, mode: 'oklch', nSteps });
        let k = 0;
        bench(`oklch, at rest, darken, fading brightness, ${name}`, () => {
            theme.tick();
            read(theme, 0.2 + (k++ % 50) / 100);
        });
    }
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

// The same for a rotation: one color replaced in place, so the tick measures only the part of the wheel it
// changes.
describe('transition tick, rotation', () => {
    for (const nSteps of STEP_COUNTS) {
        for (const mode of MODES) {
            const t = inTransition(() => {
                const theme = new Theme({ colors: GOLD, mode, nSteps });
                theme.rotateColor('#17a398', { transitionSpeed: 0.01 });
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

// The same, for a transition timed with transitionDuration (long enough not to finish mid-run).
// A timed tick only advances a counter: the colors are mixed when read, as in the LED frame benchmarks.
describe('transition tick, timed', () => {
    for (const nSteps of STEP_COUNTS) {
        for (const mode of MODES) {
            const t = inTransition(() => {
                const theme = new Theme({ colors: GOLD, mode, nSteps });
                theme.update({ colors: DUSK, transitionDuration: 100_000 });
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
