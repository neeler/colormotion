import { describe, expect, test } from 'vitest';
import { BrightnessMode, Theme, ThemeConfig } from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];
const N_STEPS = 32;
const BRIGHTNESS_MODES: BrightnessMode[] = ['darken', 'linear'];

function makeTheme(config: ThemeConfig = {}) {
    const theme = new Theme({ colors: GOLD, nSteps: N_STEPS, ...config });
    const events: boolean[] = [];
    theme.subscribe((event) => events.push(event.isTransitioning));
    return { theme, events };
}

/** Everything observable about a theme at one moment. */
function snapshot(theme: Theme) {
    return {
        colors: Array.from({ length: N_STEPS }, (_, i) =>
            theme.getColor(i).rgba(false),
        ),
        distance: theme.transitionDistance,
        target: theme.targetPalette?.key,
        index: theme.normalizeIndex(0),
    };
}

/**
 * Ticks both themes together until both finish transitioning, checking that they match at every tick.
 * Returns the number of ticks taken.
 */
function expectSameTransition(a: Theme, b: Theme) {
    let ticks = 0;
    expect(snapshot(a)).toEqual(snapshot(b));
    while (a.targetPalette || b.targetPalette) {
        a.tick();
        b.tick();
        ticks++;
        expect(snapshot(a), `tick ${ticks}`).toEqual(snapshot(b));
        expect(ticks).toBeLessThan(10_000);
    }
    return ticks;
}

function hasNaN(theme: Theme) {
    return Array.from({ length: N_STEPS }, (_, i) =>
        theme.getColor(i).rgba(false),
    ).some((rgba) => rgba.some(Number.isNaN));
}

describe('transitionSpeed', () => {
    test('NaN is treated as not given', () => {
        const nan = makeTheme();
        const unset = makeTheme();
        nan.theme.update({ colors: DUSK, transitionSpeed: NaN });
        unset.theme.update({ colors: DUSK });
        let sawNaN = false;
        const check = () => (sawNaN ||= hasNaN(nan.theme));
        check();
        const ticks = expectSameTransition(nan.theme, unset.theme);
        check();
        expect(sawNaN).toBe(false);
        // the default speed takes many ticks; a NaN speed used to snap on the second
        expect(ticks).toBeGreaterThan(2);
        expect(nan.events).toEqual(unset.events);
    });

    test('Infinity still means 1, and -Infinity and null still mean 0', () => {
        const cases: [unknown, number][] = [
            [Infinity, 1],
            [-Infinity, 0],
            [null, 0],
        ];
        for (const [given, equivalent] of cases) {
            const a = makeTheme().theme;
            const b = makeTheme().theme;
            a.update({ colors: DUSK, transitionSpeed: given as number });
            b.update({ colors: DUSK, transitionSpeed: equivalent });
            const ticks = expectSameTransition(a, b);
            if (equivalent === 0) {
                // a speed of 0 is applied on the second tick
                expect(ticks).toBe(2);
            }
        }
    });
});

describe('brightness', () => {
    for (const brightnessMode of BRIGHTNESS_MODES) {
        test(`setting NaN is ignored (${brightnessMode})`, () => {
            const { theme, events } = makeTheme({ brightnessMode });
            theme.brightness = 0.4;
            const before = snapshot(theme);
            theme.brightness = NaN;
            expect(theme.brightness).toBe(0.4);
            expect(snapshot(theme)).toEqual(before);
            // only the change to 0.4 was published
            expect(events).toEqual([false]);
        });

        test(`a NaN getColor brightness counts as 1 (${brightnessMode})`, () => {
            const { theme } = makeTheme({ brightnessMode });
            for (let i = 0; i < N_STEPS; i++) {
                expect(theme.getColor(i, { brightness: NaN })).toBe(
                    theme.getColor(i),
                );
            }
            theme.brightness = 0.5;
            for (let i = 0; i < N_STEPS; i++) {
                expect(
                    theme.getColor(i, { brightness: NaN }).rgba(false),
                ).toEqual(theme.getColor(i).rgba(false));
            }
        });
    }
});

describe('indexes', () => {
    for (const n of [NaN, Infinity, -Infinity]) {
        test(`tick(${n}) advances a transition without moving the index`, () => {
            const bad = makeTheme().theme;
            const still = makeTheme().theme;
            bad.tick(3);
            still.tick(3);
            bad.update({ colors: DUSK });
            still.update({ colors: DUSK });
            bad.tick(n);
            still.tick(0);
            expect(snapshot(bad)).toEqual(snapshot(still));
            expect(bad.normalizeIndex(0)).toBe(3);
            bad.tick(2);
            still.tick(2);
            expect(snapshot(bad)).toEqual(snapshot(still));
        });

        test(`getColor(${n}) is the color at index 0`, () => {
            const { theme } = makeTheme();
            theme.tick(5);
            expect(theme.normalizeIndex(n)).toBe(theme.normalizeIndex(0));
            expect(theme.getColor(n)).toBe(theme.getColor(0));
        });
    }

    test('fractional ticks add up, and colors are read at the nearest step', () => {
        const { theme } = makeTheme();
        // positions 0, 0.25, 0.5, … 2.25 (quarters are exact, so no position sits a hair off a half)
        const expected = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
        for (const index of expected) {
            expect(theme.normalizeIndex(0)).toBe(index);
            expect(theme.getColor(2)).toBe(
                theme.activePalette.scaleColors[index + 2],
            );
            theme.tick(0.25);
        }
        theme.tick(-2.5);
        expect(theme.normalizeIndex(0)).toBe(0);
        // back past 0 wraps around, to N_STEPS - 0.75
        theme.tick(-0.75);
        expect(theme.normalizeIndex(0)).toBe(N_STEPS - 1);
    });

    test('finite indexes still wrap as before', () => {
        const { theme } = makeTheme();
        theme.tick(-3);
        expect(theme.normalizeIndex(0)).toBe(N_STEPS - 3);
        expect(theme.normalizeIndex(N_STEPS * 5 + 4.4)).toBe(1);
        expect(theme.normalizeIndex(-1e9)).toBe(
            (((N_STEPS - 3 - 1e9) % N_STEPS) + N_STEPS) % N_STEPS,
        );
    });
});
