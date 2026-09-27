import chroma from 'chroma-js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
    BrightnessMode,
    InterpolationMode,
    InterpolationModes,
    Theme,
    ThemeConfig,
} from '../src';

const N_STEPS = 48;
const MODES = Object.values(InterpolationModes);
const BRIGHTNESS_MODES: BrightnessMode[] = ['darken', 'linear'];
// getColor's brightness option: unset, full, dimmed, off, beyond both ends, and NaN (which counts as 1)
const BRIGHTNESSES = [undefined, 1, 0.6, 0.05, 0, -0.5, 1.5, NaN];
// black, white and a gray have no hue: the hue modes' special cases
const EDGES = ['#000000', '#ff3b1f', '#ffffff', '#808080', '#00ffff'];
const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];

function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeTheme(config: ThemeConfig = {}) {
    return new Theme({ colors: GOLD, nSteps: N_STEPS, ...config });
}

/** What fillRgb writes: getColor's channels over 255 (for max 1), index by index. */
function expected(theme: Theme, brightness?: number, max = 1) {
    const values: number[] = [];
    for (let i = 0; i < theme.nSteps; i++) {
        for (const v of theme.getColor(i, { brightness }).rgb(false)) {
            values.push(v / (255 / max));
        }
    }
    return values;
}

/**
 * Fills with every brightness option in turn (all on the same tick, so the fill's caches see them one after
 * another) and returns the values that differ from getColor's, with where they are. They are the same, not
 * just within rounding (1e-9 would do): fillRgb mirrors chroma-js's arithmetic.
 */
function mismatches(theme: Theme, state: string) {
    const out = new Float64Array(theme.nSteps * 3);
    const found: string[] = [];
    for (const brightness of BRIGHTNESSES) {
        theme.fillRgb(out, { brightness });
        const want = expected(theme, brightness);
        want.forEach((value, j) => {
            const got = out[j]!;
            const same =
                got === value || (Number.isNaN(got) && Number.isNaN(value));
            if (!same && found.length < 5) {
                found.push(
                    `${state}, brightness ${brightness}, value ${j}: ${got} instead of ${value}`,
                );
            }
        });
    }
    return found;
}

/**
 * Walks a theme through rest, the wheel moving, both kinds of transition and a change of target midway,
 * calling check in each state.
 */
function walk(theme: Theme, check: (state: string) => void) {
    check('at rest');
    theme.tick(theme.nSteps - 0.4);
    check('with the wheel a hair short of a whole turn');
    theme.tick(2.8);
    check('after a fractional tick');
    theme.tick(0.7);
    check('after fractional ticks that add up past a half');
    theme.tick(-5.6);
    check('after the wheel moved backward, past 0');
    theme.brightness = 0.35;
    check('at rest, theme brightness 0.35');

    theme.randomTheme({ transitionSpeed: 0.05 });
    check('transitionSpeed, before the first tick');
    theme.tick(1.5);
    check('transitionSpeed, tick 1');
    for (let k = 0; k < 6; k++) theme.tick(0.3);
    expect(theme.isTransitioning).toBe(true);
    check('transitionSpeed, tick 7');

    theme.update({ colors: EDGES, transitionDuration: 30 });
    check('a new target midway, before its first tick');
    theme.tick();
    check('transitionDuration, tick 1');
    for (let k = 1; k < 15; k++) theme.tick(-1);
    check('transitionDuration, tick 15');
    theme.brightness = 1;
    check('transitionDuration, tick 15, full brightness');
    for (let k = 15; k < 29; k++) theme.tick(0);
    expect(theme.isTransitioning).toBe(true);
    check('transitionDuration, tick 29');
    theme.tick();
    expect(theme.isTransitioning).toBe(false);
    check('at rest on the target');

    theme.randomTheme({ transitionDuration: 8 });
    theme.tick();
    theme.tick();
    theme.finishTransition();
    check('after finishTransition');
}

describe('fillRgb matches getColor', () => {
    for (const brightnessMode of BRIGHTNESS_MODES) {
        for (const [m, mode] of MODES.entries()) {
            test(`${mode}, ${brightnessMode}`, () => {
                const theme = Theme.random({
                    nColors: 5,
                    nSteps: N_STEPS,
                    mode,
                    brightnessMode,
                    random: seeded(100 + m),
                });
                const found: string[] = [];
                walk(theme, (state) => found.push(...mismatches(theme, state)));
                expect(found).toEqual([]);
            });
        }
    }

    test('when the mode changes midway', () => {
        for (const brightnessMode of BRIGHTNESS_MODES) {
            const theme = makeTheme({ mode: 'hsv', brightnessMode });
            theme.brightness = 0.8;
            const found: string[] = [];
            theme.update({ colors: DUSK, transitionSpeed: 0.2 });
            theme.tick();
            for (const mode of ['oklch', 'lab', 'hsi'] as const) {
                theme.setMode(mode, { transitionDuration: 10 });
                found.push(...mismatches(theme, `to ${mode}, tick 0`));
                theme.tick();
                theme.tick();
                found.push(...mismatches(theme, `to ${mode}, tick 2`));
            }
            expect(found, brightnessMode).toEqual([]);
        }
    });

    test('when palette and targetPalette are assigned', () => {
        for (const brightnessMode of BRIGHTNESS_MODES) {
            const theme = makeTheme({ mode: 'oklch', brightnessMode });
            const other = makeTheme({ colors: DUSK, mode: 'lch' });
            const found: string[] = [];
            theme.targetPalette = other.palette;
            theme.tick();
            found.push(
                ...mismatches(theme, 'transitioning to an assigned palette'),
            );
            theme.targetPalette = undefined;
            found.push(...mismatches(theme, 'transition cancelled'));
            theme.palette = other.palette;
            found.push(...mismatches(theme, 'palette assigned'));
            expect(found, brightnessMode).toEqual([]);
        }
    });

    test('at the default 2048 steps', () => {
        const theme = new Theme({
            colors: GOLD,
            mode: 'oklch',
            brightnessMode: 'linear',
        });
        const found = mismatches(theme, 'at rest');
        theme.update({ colors: DUSK, transitionDuration: 60 });
        theme.tick(700);
        found.push(...mismatches(theme, 'transitioning'));
        expect(found).toEqual([]);
    });

    test('for one or two colors, translucent colors, a cropped palette and a few steps', () => {
        const palettes: [string, ThemeConfig][] = [
            // a one-color palette's scale mixes the color with itself
            ['one color', { nColors: 1 }],
            ['two translucent colors', { colors: ['#ff000080', '#0000ffcc'] }],
            ['five colors cut to two', { colors: EDGES, maxNumberOfColors: 2 }],
        ];
        const found: string[] = [];
        for (const brightnessMode of BRIGHTNESS_MODES) {
            for (const [m, mode] of MODES.entries()) {
                for (const [name, config] of palettes) {
                    for (const nSteps of [2, 3]) {
                        const theme = new Theme({
                            ...config,
                            nSteps,
                            mode,
                            brightnessMode,
                            random: seeded(200 + m),
                        });
                        const label = `${mode}, ${brightnessMode}, ${name}, ${nSteps} steps`;
                        walk(theme, (state) =>
                            found.push(
                                ...mismatches(theme, `${label}, ${state}`),
                            ),
                        );
                    }
                }
            }
        }
        expect(found).toEqual([]);
    });

    test('with a single step', () => {
        const theme = makeTheme({ nSteps: 1, mode: 'lab' });
        const found = mismatches(theme, 'at rest');
        theme.update({ colors: DUSK, transitionSpeed: 0.3 });
        theme.tick();
        found.push(...mismatches(theme, 'transitioning'));
        expect(found).toEqual([]);
    });
});

describe('fillRgb output', () => {
    test('goes at the offset, and nothing else in the array changes', () => {
        const theme = makeTheme({ mode: 'oklch' });
        theme.update({ colors: DUSK, transitionDuration: 20 });
        theme.tick(3);
        const size = N_STEPS * 3;
        const reference = theme.fillRgb(new Float64Array(size));

        const float64 = new Float64Array(size + 10).fill(-1);
        expect(theme.fillRgb(float64, { offset: 7 })).toBe(float64);
        expect([...float64.subarray(0, 7)]).toEqual(Array(7).fill(-1));
        expect([...float64.subarray(7, 7 + size)]).toEqual([...reference]);
        expect([...float64.subarray(7 + size)]).toEqual([-1, -1, -1]);

        // a Float32Array holds each value rounded to single precision
        const float32 = new Float32Array(size + 1).fill(-1);
        expect(theme.fillRgb(float32, { offset: 1 })).toBe(float32);
        expect(float32[0]).toBe(-1);
        expect([...float32.subarray(1)]).toEqual(
            [...reference].map(Math.fround),
        );

        const array: number[] = Array(size + 2).fill(-1);
        expect(theme.fillRgb(array, { offset: 2 })).toBe(array);
        expect(array).toEqual([-1, -1, ...reference]);

        // exactly the size needed
        expect(() => theme.fillRgb(new Float32Array(size))).not.toThrow();
        expect(() =>
            theme.fillRgb(new Float32Array(size + 4), { offset: 4 }),
        ).not.toThrow();
    });

    test('max sets the value of a full channel', () => {
        const theme = makeTheme({ mode: 'lab', brightnessMode: 'linear' });
        const out = new Float64Array(N_STEPS * 3);
        // 255 gives chroma's own channels, at rest and mid-transition
        theme.fillRgb(out, { max: 255 });
        const channels = () =>
            Array.from({ length: N_STEPS }, (_, i) =>
                theme.getColor(i).rgb(false),
            ).flat();
        expect([...out]).toEqual(channels());
        theme.update({ colors: DUSK, transitionDuration: 10 });
        theme.tick(5);
        theme.fillRgb(out, { max: 255 });
        expect([...out]).toEqual(channels());

        theme.brightness = 0.5;
        theme.fillRgb(out, { max: 255, brightness: 0.4 });
        expect([...out]).toEqual(expected(theme, 0.4, 255));
        theme.fillRgb(out, { max: 100, brightness: 0.4 });
        expect([...out]).toEqual(expected(theme, 0.4, 100));

        // anything that is not a finite number above 0 counts as 1
        const unit = theme.fillRgb(new Float64Array(N_STEPS * 3));
        for (const max of [NaN, Infinity, -Infinity, 0, -0, -255]) {
            expect([...theme.fillRgb(out, { max })], `${max}`).toEqual([
                ...unit,
            ]);
        }
    });

    test('throws a RangeError for an array too short or a bad offset', () => {
        const theme = makeTheme();
        const size = N_STEPS * 3;
        expect(() => theme.fillRgb(new Float32Array(size - 1))).toThrow(
            RangeError,
        );
        expect(() => theme.fillRgb([])).toThrow(RangeError);
        expect(() =>
            theme.fillRgb(new Float64Array(size), { offset: 1 }),
        ).toThrow(RangeError);
        for (const offset of [-1, 0.5, NaN, Infinity, 2 ** 53]) {
            expect(
                () => theme.fillRgb(new Float64Array(size * 2), { offset }),
                `offset ${offset}`,
            ).toThrow(RangeError);
        }
        // nothing is written when it throws
        const out = new Float64Array(size - 1).fill(-1);
        expect(() => theme.fillRgb(out)).toThrow(RangeError);
        expect(out.every((v) => v === -1)).toBe(true);
    });
});

describe('fillRgb caching', () => {
    const colorMethods = [
        'rgb',
        'rgba',
        'alpha',
        'lab',
        'oklab',
        'oklch',
        'hcl',
        'lch',
        'hsl',
        'hsv',
        'hsi',
        'darken',
    ] as const;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Spies on the Color methods a fill could read colors through, and returns their total call count. */
    function spyOnColors() {
        const prototype = chroma.Color.prototype as unknown as Record<
            string,
            (...args: unknown[]) => unknown
        >;
        const spies = colorMethods.map((name) => vi.spyOn(prototype, name));
        return () => spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0);
    }

    for (const brightnessMode of BRIGHTNESS_MODES) {
        test(`reads no Color once a palette's colors are converted (${brightnessMode})`, () => {
            const theme = makeTheme({ mode: 'oklch', brightnessMode });
            theme.brightness = 0.7;
            const out = new Float64Array(N_STEPS * 3);
            theme.update({ colors: DUSK, transitionDuration: 100 });
            theme.tick();
            // the first fill converts both palettes' colors
            theme.fillRgb(out, { brightness: 0.5 });

            const calls = spyOnColors();
            for (let k = 0; k < 5; k++) {
                theme.tick();
                theme.fillRgb(out, { brightness: 0.5 });
                theme.fillRgb(out);
            }
            expect(calls()).toBe(0);

            // at rest on the target: the first fill reads its colors' channels, once
            theme.finishTransition();
            theme.fillRgb(out);
            const converted = calls();
            expect(converted).toBeGreaterThan(0);
            expect(converted).toBeLessThanOrEqual(N_STEPS);
            for (const brightness of [0.25, 1, 0.25, 0]) {
                theme.fillRgb(out, { brightness });
            }
            theme.tick(3);
            theme.fillRgb(out);
            expect(calls()).toBe(converted);
        });
    }

    test("leaves getColor's colors as they are", () => {
        const theme = makeTheme({ mode: 'lab' });
        theme.update({ colors: DUSK, transitionSpeed: 0.1 });
        theme.tick();
        const colors = Array.from({ length: N_STEPS }, (_, i) =>
            theme.getColor(i),
        );
        const rgba = colors.map((c) => c.rgba(false));
        theme.fillRgb(new Float64Array(N_STEPS * 3), { brightness: 0.5 });
        for (let i = 0; i < N_STEPS; i++) {
            // the same Color objects, from getColor's cache for this tick, unchanged
            expect(theme.getColor(i)).toBe(colors[i]);
            expect(colors[i]!.rgba(false)).toEqual(rgba[i]);
        }
    });

    test('follows the theme brightness and the brightness option apart (darken)', () => {
        const theme = makeTheme({ mode: 'oklch' });
        const out = new Float64Array(N_STEPS * 3);
        const found: string[] = [];
        for (const state of ['at rest', 'transitioning']) {
            if (state === 'transitioning') {
                theme.update({ colors: DUSK, transitionDuration: 10 });
                theme.tick();
            }
            // the theme brightness changes between fills with the same option, on the same tick
            for (const themeBrightness of [0.5, 0.8, 1, 0.5]) {
                theme.brightness = themeBrightness;
                for (const brightness of [0.6, 0.3, 0.6]) {
                    theme.fillRgb(out, { brightness });
                    const want = expected(theme, brightness);
                    if (want.some((value, j) => out[j] !== value)) {
                        found.push(
                            `${state}, theme brightness ${themeBrightness}, brightness ${brightness}`,
                        );
                    }
                }
            }
        }
        expect(found).toEqual([]);
    });

    test('follows a change of brightness at rest (darken)', () => {
        const theme = makeTheme({ mode: 'hcl' });
        const out = new Float64Array(N_STEPS * 3);
        for (const brightness of [0.2, 0.9, 0.2, 1, 0.2]) {
            theme.brightness = brightness;
            theme.fillRgb(out);
            expect([...out], `${brightness}`).toEqual(expected(theme));
        }
    });
});

describe('fillRgb reads each color with getColor', () => {
    test.each(['lab', 'lch', 'hcl', 'oklab', 'oklch'] as const)(
        'when chroma is on a Lab white point other than D65, and back, mid-transition (%s)',
        (mode) => {
            const theme = makeTheme({ mode });
            theme.brightness = 0.6;
            theme.update({ colors: DUSK, transitionDuration: 20 });
            theme.tick(4);
            const d65 = theme.fillRgb(new Float64Array(N_STEPS * 3));
            try {
                chroma.setLabWhitePoint('D50');
                const d50 = theme.fillRgb(new Float64Array(N_STEPS * 3));
                // getColor's colors under D50, not the buffers' (which assume D65)
                expect(mismatches(theme, 'D50')).toEqual([]);
                expect([...d50]).not.toEqual([...d65]);
            } finally {
                chroma.setLabWhitePoint('d65' as 'D65');
            }
            // getColor reads its colors again under the white point in effect, so the two agree mid-transition
            expect(theme.isTransitioning).toBe(true);
            expect(mismatches(theme, 'back on D65')).toEqual([]);
            expect([...theme.fillRgb(new Float64Array(N_STEPS * 3))]).toEqual([
                ...d65,
            ]);
        },
    );

    test('for an nSteps that is not a whole number', () => {
        const mode: InterpolationMode = 'rgb';
        const theme = makeTheme({ nSteps: 10.5, mode });
        // the whole numbers below 10.5: 0 to 10
        const out = theme.fillRgb(new Float64Array(33));
        expect([...out]).toEqual(
            Array.from({ length: 11 }, (_, i) =>
                theme
                    .getColor(i)
                    .rgb(false)
                    .map((v) => v / 255),
            ).flat(),
        );
        expect(() => theme.fillRgb(new Float64Array(32))).toThrow(RangeError);
    });
});
