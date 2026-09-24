import chroma, { Color } from 'chroma-js';
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
    ColorUpdateConfig,
    InterpolationMode,
    InterpolationModes,
    Theme,
    ThemeConfig,
} from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];
const JADE = ['#0f5c4a', '#8fd6b4', '#1a2e2a'];
const N_STEPS = 64;

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function makeTheme(config: ThemeConfig = {}) {
    const theme = new Theme({ colors: GOLD, nSteps: N_STEPS, ...config });
    const events: boolean[] = [];
    theme.subscribe((event) => events.push(event.isTransitioning));
    return { theme, events };
}

function colorsOf(theme: Theme) {
    return Array.from({ length: N_STEPS }, (_, i) =>
        theme.getColor(i).rgba(false),
    );
}

/** Ticks until the transition ends, returning how many ticks it took. */
function ticksToFinish(theme: Theme, limit = 100_000) {
    let ticks = 0;
    while (theme.isTransitioning) {
        theme.tick(0);
        ticks++;
        if (ticks > limit) {
            throw new Error('transition did not finish');
        }
    }
    return ticks;
}

function expectAtPalette(theme: Theme, scaleColors: Color[]) {
    for (let i = 0; i < N_STEPS; i++) {
        expect(theme.getColor(i)).toBe(scaleColors[i]);
    }
}

describe('transitionDuration', () => {
    for (const duration of [1, 2, 15, 120, 360]) {
        test(`ends on tick ${duration}`, () => {
            const { theme, events } = makeTheme();
            theme.update({ colors: DUSK, transitionDuration: duration });
            const target = theme.targetPalette!;
            for (let k = 1; k < duration; k++) {
                theme.tick(0);
                expect(theme.isTransitioning).toBe(true);
            }
            theme.tick(0);
            expect(theme.isTransitioning).toBe(false);
            expect(events).toEqual([true, false]);
            // exactly the target palette: no residue
            expectAtPalette(theme, target.scaleColors);
        });
    }

    for (const mode of Object.values(InterpolationModes)) {
        test(`eases along smoothstep (${mode})`, () => {
            const { theme } = makeTheme({ mode });
            const start = theme.activePalette.scaleColors;
            theme.update({ colors: DUSK, transitionDuration: 40 });
            const target = theme.targetPalette!.scaleColors;
            // before the first tick, the colors have not moved
            expect(colorsOf(theme)).toEqual(start.map((c) => c.rgba(false)));
            let k = 0;
            for (const at of [1, 10, 20, 39]) {
                while (k < at) {
                    theme.tick(0);
                    k++;
                }
                const f = smoothstep(at / 40);
                for (let i = 0; i < N_STEPS; i++) {
                    expect(theme.getColor(i).rgba(false)).toEqual(
                        chroma.mix(start[i]!, target[i]!, f, mode).rgba(false),
                    );
                }
            }
        });
    }

    test('fractional and nearly whole durations end on the expected tick', () => {
        const cases: [number, number][] = [
            [2.5, 3],
            [55.5, 56],
            [0.001, 1],
            [1e-12, 1],
            [1, 1],
            [2.4, 3],
            [55.2, 56],
            [1.1 * 50, 55],
            [4.1 * 60, 246],
            [2.3 * 50, 115],
            // the snap is relative to the whole number: 5e-10 of it snaps, 2e-9 does not
            [1000 * (1 + 5e-10), 1000],
            [1000 * (1 + 2e-9), 1001],
        ];
        for (const [duration, ticks] of cases) {
            const { theme } = makeTheme();
            theme.update({ colors: DUSK, transitionDuration: duration });
            expect(ticksToFinish(theme), `duration ${duration}`).toBe(ticks);
        }
    });

    test('a fractional duration eases over its exact length', () => {
        const { theme } = makeTheme({ mode: 'lab' });
        const start = theme.activePalette.scaleColors;
        theme.update({ colors: DUSK, transitionDuration: 2.5 });
        const target = theme.targetPalette!.scaleColors;
        for (const k of [1, 2]) {
            theme.tick(0);
            expect(theme.getColor(7).rgba(false)).toEqual(
                chroma
                    .mix(start[7]!, target[7]!, smoothstep(k / 2.5), 'lab')
                    .rgba(false),
            );
        }
    });

    for (const duration of [0, -0, -5]) {
        test(`${Object.is(duration, -0) ? '-0' : duration} applies the palette at once`, () => {
            const { theme, events } = makeTheme();
            theme.update({ colors: DUSK, transitionDuration: duration });
            expect(theme.isTransitioning).toBe(false);
            expect(events).toEqual([false]);
            expect(theme.activePaletteHexes).toEqual(DUSK);
            expectAtPalette(theme, theme.palette.scaleColors);
        });
    }

    test('0 mid-transition applies a new palette at once', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 50 });
        theme.tick(0);
        theme.update({ colors: JADE, transitionDuration: 0 });
        expect(theme.isTransitioning).toBe(false);
        expect(events).toEqual([true, false]);
        expect(theme.activePaletteHexes).toEqual(JADE);
        expectAtPalette(theme, theme.palette.scaleColors);
    });

    test('0 for the palette in flight finishes the transition', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: DUSK });
        const target = theme.targetPalette!;
        theme.tick(0);
        theme.update({ colors: DUSK, transitionDuration: 0 });
        expect(theme.isTransitioning).toBe(false);
        expect(events).toEqual([true, false]);
        expectAtPalette(theme, target.scaleColors);
    });

    test('0 for the palette at rest does nothing', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: GOLD, transitionDuration: 0 });
        expect(events).toEqual([]);
    });

    test('values that are not finite numbers fall back to transitionSpeed', () => {
        for (const duration of [
            NaN,
            Infinity,
            -Infinity,
            null,
            '6',
            undefined,
        ]) {
            const a = makeTheme();
            const b = makeTheme();
            a.theme.update({
                colors: DUSK,
                transitionSpeed: 0.3,
                transitionDuration: duration as number,
            });
            b.theme.update({ colors: DUSK, transitionSpeed: 0.3 });
            let ticks = 0;
            do {
                expect(ticks++).toBeLessThan(10_000);
                expect(colorsOf(a.theme)).toEqual(colorsOf(b.theme));
                expect(a.theme.transitionDistance).toBe(
                    b.theme.transitionDistance,
                );
                a.theme.tick();
                b.theme.tick();
            } while (a.theme.isTransitioning || b.theme.isTransitioning);
            expect(a.events).toEqual(b.events);
        }
    });

    test('takes precedence over transitionSpeed', () => {
        const slow = makeTheme().theme;
        slow.update({
            colors: DUSK,
            transitionSpeed: 0,
            transitionDuration: 4,
        });
        // a speed of 0 alone would finish on tick 2
        expect(ticksToFinish(slow)).toBe(4);
        const fast = makeTheme().theme;
        fast.update({
            colors: DUSK,
            transitionSpeed: 1,
            transitionDuration: 30,
        });
        expect(ticksToFinish(fast)).toBe(30);
    });

    test('counts one tick per tick(), whatever n is', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 5 });
        const steps = [5, -3, 1000, 0, 2];
        steps.forEach((n, k) => {
            theme.tick(n);
            expect(theme.isTransitioning, `after tick ${k + 1}`).toBe(
                k < steps.length - 1,
            );
        });
        const sum = steps.reduce((a, b) => a + b, 0);
        expect(theme.normalizeIndex(0)).toBe(
            ((sum % N_STEPS) + N_STEPS) % N_STEPS,
        );
    });

    test('0 applies a mode change at once, and later updates keep it', () => {
        const { theme } = makeTheme({ mode: 'rgb' });
        const modes: string[] = [];
        theme.subscribe((event) => modes.push(event.mode));
        theme.setMode('lab', { transitionDuration: 0 });
        expect(theme.mode).toBe('lab');
        expect(modes).toEqual(['lab']);
        theme.update({ colors: DUSK, transitionDuration: 0 });
        expect(theme.palette.mode).toBe('lab');
    });

    test('a mode change with nothing to see still takes its duration', () => {
        const { theme } = makeTheme({ colors: ['#e8b450'] });
        theme.setMode('lab', { transitionDuration: 8 });
        expect(theme.mode).toBe('lab');
        expect(ticksToFinish(theme)).toBe(8);
    });

    test('rotateMode with a duration mixes in the new mode', () => {
        const { theme } = makeTheme({ mode: 'rgb' });
        const start = theme.activePalette.scaleColors;
        theme.rotateMode({ transitionDuration: 10 });
        const mode = theme.mode;
        expect(mode).toBe('lab');
        const target = theme.targetPalette!.scaleColors;
        theme.tick(0);
        theme.tick(0);
        for (let i = 0; i < N_STEPS; i += 7) {
            expect(theme.getColor(i).rgba(false)).toEqual(
                chroma
                    .mix(start[i]!, target[i]!, smoothstep(0.2), mode)
                    .rgba(false),
            );
        }
    });
});

describe('retargeting', () => {
    test('a new palette mid-transition continues from the current colors', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 100 });
        for (let k = 0; k < 30; k++) {
            theme.tick(0);
        }
        const before = colorsOf(theme);
        theme.update({ colors: JADE, transitionDuration: 20 });
        expect(colorsOf(theme)).toEqual(before);
        expect(ticksToFinish(theme)).toBe(20);
        expect(theme.activePaletteHexes).toEqual(JADE);
        expect(events).toEqual([true, true, false]);
    });

    test('switching between speed and duration is continuous', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionSpeed: 0.3 });
        theme.tick(0);
        theme.tick(0);
        let before = colorsOf(theme);
        theme.update({ colors: JADE, transitionDuration: 12 });
        expect(colorsOf(theme)).toEqual(before);
        for (let k = 0; k < 5; k++) {
            theme.tick(0);
        }
        before = colorsOf(theme);
        theme.update({ colors: GOLD, transitionSpeed: 0.3 });
        expect(colorsOf(theme)).toEqual(before);
        ticksToFinish(theme);
        expect(theme.activePaletteHexes).toEqual(GOLD);
    });

    test('re-sending the same duration changes nothing', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 100 });
        let ticks = 0;
        while (theme.isTransitioning && ticks <= 100) {
            theme.update({ colors: DUSK, transitionDuration: 100 });
            // same target without a duration: ignored, as before
            theme.setColors(DUSK, { transitionSpeed: 0.9 });
            theme.tick(0);
            ticks++;
        }
        expect(ticks).toBe(100);
        expect(events).toEqual([true, false]);
    });

    test('re-sending a nearly whole duration changes nothing', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 1.1 * 50 });
        let ticks = 0;
        while (theme.isTransitioning && ticks <= 55) {
            theme.update({ colors: DUSK, transitionDuration: 1.1 * 50 });
            theme.tick(0);
            ticks++;
        }
        expect(ticks).toBe(55);
        expect(events).toEqual([true, false]);
    });

    for (const mode of Object.values(InterpolationModes)) {
        test(`a different duration re-times from the current colors (${mode})`, () => {
            const { theme, events } = makeTheme({
                mode,
                colors: ['#808080', '#ffffff', '#e8b450', '#000000'],
            });
            const start = theme.activePalette.scaleColors;
            theme.update({ colors: DUSK, transitionDuration: 100 });
            const target = theme.targetPalette!.scaleColors;
            for (let k = 0; k < 30; k++) {
                theme.tick(0);
            }
            const before = colorsOf(theme);
            theme.update({ colors: DUSK, transitionDuration: 20 });
            expect(colorsOf(theme)).toEqual(before);
            expect(events).toEqual([true]);
            theme.tick(0);
            const base = smoothstep(30 / 100);
            const f = base + (1 - base) * smoothstep(1 / 20);
            for (let i = 0; i < N_STEPS; i += 5) {
                expect(theme.getColor(i).rgba(false)).toEqual(
                    chroma
                        .mix(
                            start[i]!,
                            target[i]!,
                            f,
                            mode as InterpolationMode,
                        )
                        .rgba(false),
                );
            }
            expect(ticksToFinish(theme)).toBe(19);
            expect(events).toEqual([true, false]);
        });
    }

    test('a new palette after a re-time eases from rest', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 100 });
        for (let k = 0; k < 30; k++) {
            theme.tick(0);
        }
        theme.update({ colors: DUSK, transitionDuration: 50 });
        for (let k = 0; k < 5; k++) {
            theme.tick(0);
        }
        const start = Array.from({ length: N_STEPS }, (_, i) =>
            theme.getColor(i),
        );
        theme.update({ colors: JADE, transitionDuration: 20 });
        const target = theme.targetPalette!.scaleColors;
        theme.tick(0);
        for (let i = 0; i < N_STEPS; i += 5) {
            expect(theme.getColor(i).rgba(false)).toEqual(
                chroma
                    .mix(start[i]!, target[i]!, smoothstep(1 / 20), 'rgb')
                    .rgba(false),
            );
        }
        expect(ticksToFinish(theme)).toBe(19);
    });

    test('a longer duration re-times too', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 50 });
        for (let k = 0; k < 40; k++) {
            theme.tick(0);
        }
        theme.update({ colors: DUSK, transitionDuration: 200 });
        expect(ticksToFinish(theme)).toBe(200);
    });

    test('a duration re-times a speed transition in flight', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionSpeed: 0.05 });
        const target = theme.targetPalette!;
        for (let k = 0; k < 5; k++) {
            theme.tick(0);
        }
        const before = colorsOf(theme);
        theme.update({ colors: DUSK, transitionDuration: 30 });
        expect(colorsOf(theme)).toEqual(before);
        expect(ticksToFinish(theme)).toBe(30);
        expectAtPalette(theme, target.scaleColors);
    });

    test('operations that return the palette in flight re-time or finish it', () => {
        const full = makeTheme({ maxNumberOfColors: 5 }).theme;
        full.update({ colors: DUSK, transitionDuration: 50 });
        full.tick(0);
        // already at max colors: pushing returns the same palette
        full.pushNewColor('#ffffff', { transitionDuration: 10 });
        expect(ticksToFinish(full)).toBe(10);

        const single = makeTheme().theme;
        single.update({ colors: ['#e8b450'], transitionDuration: 50 });
        single.tick(0);
        // one color: popping returns the same palette
        single.popOldestColor({ transitionDuration: 0 });
        expect(single.isTransitioning).toBe(false);
    });
});

describe('transitionDistance during a timed transition', () => {
    test('is measured when read', () => {
        const { theme } = makeTheme({ mode: 'oklch' });
        theme.update({ colors: DUSK, transitionDuration: 30 });
        let previous = theme.transitionDistance!;
        expect(previous).toBeGreaterThan(0);
        for (let k = 1; k < 30; k++) {
            theme.tick(0);
            const distance = theme.transitionDistance!;
            expect(distance).toBeLessThan(previous);
            expect(theme.transitionDistance).toBe(distance);
            previous = distance;
        }
        theme.tick(0);
        expect(theme.transitionDistance).toBeUndefined();
    });

    test('reading it does not change the colors', () => {
        const read = makeTheme().theme;
        const unread = makeTheme().theme;
        read.update({ colors: DUSK, transitionDuration: 20 });
        unread.update({ colors: DUSK, transitionDuration: 20 });
        for (let k = 0; k < 20; k++) {
            void read.transitionDistance;
            read.tick(0);
            unread.tick(0);
            expect(colorsOf(read)).toEqual(colorsOf(unread));
        }
    });

    test('goes back to per-tick measurement for a speed transition', () => {
        const { theme } = makeTheme();
        theme.update({ colors: DUSK, transitionDuration: 20 });
        theme.tick(0);
        expect(theme.transitionDistance).toBeDefined();
        theme.update({ colors: JADE });
        // as for any speed transition, undefined until its first tick
        expect(theme.transitionDistance).toBeUndefined();
        theme.tick(0);
        expect(theme.transitionDistance).toBeGreaterThan(0);
    });
});

describe('finishTransition and isTransitioning', () => {
    test('finishTransition at rest does nothing', () => {
        const { theme, events } = makeTheme();
        theme.finishTransition();
        expect(events).toEqual([]);
        expect(theme.isTransitioning).toBe(false);
    });

    for (const options of [
        { transitionSpeed: 0.1 },
        { transitionDuration: 50 },
    ] as ColorUpdateConfig[]) {
        test(`finishTransition applies the target (${JSON.stringify(options)})`, () => {
            const { theme, events } = makeTheme();
            theme.update({ colors: DUSK, ...options });
            const target = theme.targetPalette!;
            theme.tick(0);
            theme.finishTransition();
            expect(theme.isTransitioning).toBe(false);
            expect(theme.transitionDistance).toBeUndefined();
            expect(events).toEqual([true, false]);
            expectAtPalette(theme, target.scaleColors);
            theme.finishTransition();
            expect(events).toEqual([true, false]);
        });
    }

    test('isTransitioning matches every published event', () => {
        const theme = new Theme({ colors: GOLD, nSteps: N_STEPS });
        const mismatches: boolean[] = [];
        theme.subscribe((event) => {
            if (theme.isTransitioning !== event.isTransitioning) {
                mismatches.push(event.isTransitioning);
            }
        });
        theme.update({ colors: DUSK, transitionDuration: 3 });
        theme.brightness = 0.5;
        ticksToFinish(theme);
        theme.update({ colors: JADE });
        theme.finishTransition();
        theme.update({ colors: GOLD, transitionDuration: 0 });
        expect(mismatches).toEqual([]);
    });

    test('a transition started when another ends begins from its first tick', () => {
        const theme = new Theme({ colors: GOLD, nSteps: N_STEPS });
        let chained = false;
        theme.subscribe((event) => {
            if (!event.isTransitioning && !chained) {
                chained = true;
                theme.setColors(JADE, { transitionDuration: 3 });
            }
        });
        theme.update({ colors: DUSK, transitionDuration: 5 });
        expect(ticksToFinish(theme)).toBe(8);
        expect(theme.activePaletteHexes).toEqual(JADE);
    });

    test('finishing from a start callback leaves the theme at rest', () => {
        const theme = new Theme({ colors: GOLD, nSteps: N_STEPS });
        theme.subscribe((event) => {
            if (event.isTransitioning) {
                theme.finishTransition();
            }
        });
        theme.update({ colors: DUSK, transitionDuration: 10 });
        expect(theme.isTransitioning).toBe(false);
        expect(theme.activePaletteHexes).toEqual(DUSK);
        theme.tick(0);
        expect(theme.activePaletteHexes).toEqual(DUSK);
    });
});

test('types', () => {
    interface Extended extends ColorUpdateConfig {
        label?: string;
    }
    const options: Extended = { transitionDuration: 6 * 60, label: 'x' };
    expectTypeOf(options.transitionDuration).toEqualTypeOf<
        number | undefined
    >();
    const theme = new Theme();
    expectTypeOf(theme.isTransitioning).toEqualTypeOf<boolean>();
    expectTypeOf(theme.finishTransition()).toEqualTypeOf<void>();
    // every palette-changing method accepts a duration
    theme.update({ colors: DUSK, transitionDuration: 1 });
    theme.setMode('lab', { transitionDuration: 1 });
    theme.rotateMode({ transitionDuration: 1 });
    theme.setColors(GOLD, { transitionDuration: 1 });
    theme.randomFrom('#662c91', { transitionDuration: 1 });
    theme.randomTheme({ transitionDuration: 1 });
    theme.pushNewColor('#17a398', { transitionDuration: 1 });
    theme.pushRandomColor({ transitionDuration: 1 });
    theme.popOldestColor({ transitionDuration: 1 });
    theme.rotateColor('#17a398', { transitionDuration: 1 });
    theme.rotateRandomColor({ transitionDuration: 1 });
});
