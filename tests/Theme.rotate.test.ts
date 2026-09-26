import chroma, { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { ColorPalette, InterpolationModes, Theme, ThemeConfig } from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a'];
const NEW = ['#0f5c4a', '#8fd6b4', '#1a2e2a', '#17a398', '#662c91'];
const N_STEPS = 64;

function makeTheme(config: ThemeConfig = {}) {
    const theme = new Theme({ colors: GOLD, nSteps: N_STEPS, ...config });
    const events: boolean[] = [];
    theme.subscribe((event) => events.push(event.isTransitioning));
    return { theme, events };
}

/** Every color the theme shows now, unrounded, from the scale's first step. */
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

/** A random function that returns the values given, over and over. */
function scripted(values: number[]) {
    let i = 0;
    return () => values[i++ % values.length]!;
}

/** The random values ColorPalette draws a color from: brightness (HSV value), hue and saturation. */
const hsvDraw = (h: number, s: number, v: number) => [v, h / 360, s];

function expectAtPalette(theme: Theme, scaleColors: Color[]) {
    for (let i = 0; i < N_STEPS; i++) {
        expect(theme.getColor(i)).toBe(scaleColors[i]);
    }
}

/** Whether a step lies strictly between the neighbours of a replaced color, around a wheel of four. */
function inSpan(step: number, replaced: number) {
    const from = ((replaced + 3) % 4) * 16;
    const to = ((replaced + 1) % 4) * 16;
    return from < to ? step > from && step < to : step > from || step < to;
}

describe('rotateColor', () => {
    test('replaces the colors oldest first, each in its position', () => {
        const { theme } = makeTheme();
        const replaced = [0, 1, 2, 3, 0];
        replaced.forEach((position, i) => {
            expect(theme.activePalette.ageOrder[0]).toBe(position);
            theme.rotateColor(NEW[i]!, { transitionDuration: 0 });
            expect(theme.activePaletteHexes[position]).toBe(NEW[i]);
        });
        expect(theme.activePaletteHexes).toEqual([
            NEW[4],
            NEW[1],
            NEW[2],
            NEW[3],
        ]);
        expect(theme.activePalette.ageOrder).toEqual([1, 2, 3, 0]);
    });

    for (const mode of Object.values(InterpolationModes)) {
        test(`only the colors between the replaced color's neighbours move (${mode})`, () => {
            const { theme } = makeTheme({ mode });
            const start = colorsOf(theme);
            theme.rotateColor(NEW[0]!, { transitionDuration: 20 });
            for (let tick = 0; tick <= 20; tick++) {
                const colors = colorsOf(theme);
                for (let step = 0; step < N_STEPS; step++) {
                    if (inSpan(step, 0)) {
                        continue;
                    }
                    if (mode === 'rgb') {
                        // mixing a color with itself in rgb gives it back exactly
                        expect(colors[step]).toEqual(start[step]);
                    } else {
                        colors[step]!.forEach((v, k) =>
                            expect(v).toBeCloseTo(start[step]![k]!, 9),
                        );
                    }
                }
                theme.tick(0);
            }
            expect(theme.isTransitioning).toBe(false);
        });
    }

    test('mid-transition, rotates the target and lands exactly on its last tick', () => {
        const { theme, events } = makeTheme();
        theme.setColors(DUSK, { transitionDuration: 50 });
        for (let k = 0; k < 20; k++) {
            theme.tick(0);
        }
        const before = colorsOf(theme);
        theme.rotateColor(NEW[0]!, { transitionDuration: 30 });
        const target = theme.targetPalette!;
        // the target's oldest color, not the palette's, and no jump
        expect(theme.activePaletteHexes).toEqual([NEW[0], ...DUSK.slice(1)]);
        expect(target.ageOrder).toEqual([1, 2, 3, 0]);
        expect(colorsOf(theme)).toEqual(before);
        for (let k = 1; k < 30; k++) {
            theme.tick(0);
            expect(theme.isTransitioning).toBe(true);
        }
        theme.tick(0);
        expect(theme.isTransitioning).toBe(false);
        expectAtPalette(theme, target.scaleColors);
        expect(theme.palette).toBe(target);
        expect(events).toEqual([true, true, false]);
    });

    test('rotating again mid-transition continues from the target', () => {
        const { theme } = makeTheme();
        theme.rotateColor(NEW[0]!, { transitionDuration: 40 });
        theme.tick(0);
        theme.rotateColor(NEW[1]!, { transitionDuration: 40 });
        theme.tick(0);
        theme.rotateRandomColor({ transitionSpeed: 0.5 });
        expect(theme.activePalette.ageOrder).toEqual([3, 0, 1, 2]);
        expect(theme.activePaletteHexes.slice(0, 2)).toEqual([NEW[0], NEW[1]]);
        expect(theme.activePaletteHexes[3]).toBe(GOLD[3]);
        expect(theme.activePaletteHexes[2]).not.toBe(GOLD[2]);
        ticksToFinish(theme);
        expect(theme.palette.ageOrder).toEqual([3, 0, 1, 2]);
    });

    test('the color it replaces still turns over, with no transition', () => {
        const { theme, events } = makeTheme();
        theme.rotateColor(GOLD[0]!);
        theme.rotateColor(GOLD[1]!, { transitionDuration: 360 });
        expect(theme.isTransitioning).toBe(false);
        expect(theme.activePaletteHexes).toEqual(GOLD);
        expect(theme.palette.ageOrder).toEqual([2, 3, 0, 1]);
        expectAtPalette(theme, theme.palette.scaleColors);
        // once for each new set of ages
        expect(events).toEqual([false, false]);
        theme.rotateColor(NEW[0]!, { transitionDuration: 0 });
        expect(theme.activePaletteHexes[2]).toBe(NEW[0]);
    });

    test('the color it replaces turns over mid-transition without changing the transition', () => {
        const { theme, events } = makeTheme();
        const plain = makeTheme().theme;
        for (const t of [theme, plain]) {
            t.setColors(DUSK, { transitionDuration: 50 });
            for (let k = 0; k < 20; k++) {
                t.tick(0);
            }
        }
        // no options, and then the same duration: neither re-times it
        theme.rotateColor(DUSK[0]!);
        theme.rotateColor(DUSK[1]!, { transitionDuration: 50 });
        expect(theme.targetPalette!.ageOrder).toEqual([2, 3, 0, 1]);
        expect(theme.activePaletteHexes).toEqual(DUSK);
        expect(events).toEqual([true, true, true]);
        for (let k = 20; k < 50; k++) {
            expect(colorsOf(theme)).toEqual(colorsOf(plain));
            expect(theme.isTransitioning).toBe(true);
            theme.tick(0);
            plain.tick(0);
        }
        expect(theme.isTransitioning).toBe(false);
        expectAtPalette(theme, theme.palette.scaleColors);
        expect(theme.palette.ageOrder).toEqual([2, 3, 0, 1]);
        expect(events).toEqual([true, true, true, false]);
    });

    test('the color it replaces turns over mid-transition, and a duration of 0 still finishes it', () => {
        const { theme, events } = makeTheme();
        theme.setColors(DUSK, { transitionSpeed: 0.05 });
        theme.tick(0);
        theme.rotateColor(DUSK[0]!, { transitionDuration: 0 });
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette.ageOrder).toEqual([1, 2, 3, 0]);
        expectAtPalette(theme, theme.palette.scaleColors);
        expect(events).toEqual([true, false]);
    });

    test('mid-transition at a transitionSpeed, the color it replaces keeps the pace', () => {
        const rotated = makeTheme().theme;
        const plain = makeTheme().theme;
        for (const t of [rotated, plain]) {
            t.setColors(DUSK, { transitionSpeed: 0.3 });
            t.tick(0);
            t.tick(0);
        }
        rotated.rotateColor(DUSK[0]!, { transitionSpeed: 0.9 });
        expect(ticksToFinish(rotated)).toBe(ticksToFinish(plain));
        expect(rotated.palette.ageOrder).toEqual([1, 2, 3, 0]);
    });

    test('with a transitionSpeed, as today', () => {
        const speed = makeTheme().theme;
        const set = makeTheme().theme;
        speed.rotateColor(NEW[0]!, { transitionSpeed: 0.3 });
        set.setColors([NEW[0]!, ...GOLD.slice(1)], { transitionSpeed: 0.3 });
        const ticks = ticksToFinish(set);
        expect(ticksToFinish(speed)).toBe(ticks);
        expect(speed.activePaletteHexes).toEqual(set.activePaletteHexes);
    });

    test('shifts the colors as before 4.0 with the migration in the docs', () => {
        const { theme } = makeTheme();
        theme.setColors([...theme.activePaletteHexes.slice(1), NEW[0]!], {
            transitionDuration: 0,
        });
        expect(theme.activePaletteHexes).toEqual([...GOLD.slice(1), NEW[0]]);
        // the colors set from a list start again from the first
        expect(theme.activePalette.ageOrder).toEqual([0, 1, 2, 3]);
    });

    test('shifts in a random color as before 4.0 with the migration in the docs', () => {
        const random = scripted([
            ...hsvDraw(240, 0.9999999, 0.9999999), // blue: too close to the last color
            ...hsvDraw(0, 0.9999999, 0.9999999), // red
        ]);
        const theme = new Theme({
            colors: ['red', 'green', 'blue'],
            nSteps: N_STEPS,
            random,
        });
        theme.setColors(theme.activePalette.popOldest().pushRandom().colors, {
            transitionDuration: 0,
        });
        expect(theme.activePaletteHexes).toEqual([
            '#008000',
            '#0000ff',
            '#ff0000',
        ]);
        expect(theme.activePalette.ageOrder).toEqual([0, 1, 2]);
    });

    test('gives back a palette whose last color matches its first through activePalette.hexes', () => {
        const { theme, events } = makeTheme({
            colors: ['red', 'green', 'blue'],
        });
        theme.rotateColor('blue', { transitionDuration: 0 });
        const blueGreenBlue = ['#0000ff', '#008000', '#0000ff'];
        expect(theme.activePaletteHexes).toEqual(blueGreenBlue);
        // without the closing repeat, the last blue is taken for it
        expect(
            new Theme({ colors: theme.activePaletteHexes }).activePalette
                .nColors,
        ).toBe(2);
        const palette = theme.palette;
        theme.setColors(theme.activePalette.hexes);
        theme.setColors(theme.activePalette.colors);
        expect(theme.palette).toBe(palette);
        expect(events).toEqual([false]);
        expect(
            new Theme({ colors: theme.activePalette.hexes }).activePaletteHexes,
        ).toEqual(blueGreenBlue);
    });
});

describe('the other palette changes keep the ages', () => {
    function rotatedTheme(config: ThemeConfig = {}) {
        const made = makeTheme(config);
        made.theme.rotateColor(NEW[0]!, { transitionDuration: 0 });
        expect(made.theme.activePalette.ageOrder).toEqual([1, 2, 3, 0]);
        return made;
    }

    test('setMode, rotateMode and update or setColors with the same colors', () => {
        const { theme } = rotatedTheme();
        const hexes = theme.activePaletteHexes;
        theme.setMode('lab');
        theme.rotateMode();
        theme.update({ colors: hexes, mode: 'oklch' });
        theme.setColors(hexes);
        ticksToFinish(theme);
        expect(theme.mode).toBe('oklch');
        expect(theme.activePalette.ageOrder).toEqual([1, 2, 3, 0]);
        theme.rotateColor(NEW[1]!, { transitionDuration: 0 });
        expect(theme.activePaletteHexes[1]).toBe(NEW[1]);
    });

    test('pushNewColor adds the newest, and popOldestColor drops the oldest by age', () => {
        const { theme } = rotatedTheme();
        theme.pushNewColor(NEW[1]!, { transitionDuration: 0 });
        expect(theme.activePalette.ageOrder).toEqual([1, 2, 3, 0, 4]);
        theme.popOldestColor({ transitionDuration: 0 });
        expect(theme.activePaletteHexes).toEqual([
            NEW[0],
            GOLD[2],
            GOLD[3],
            NEW[1],
        ]);
        expect(theme.activePalette.ageOrder).toEqual([1, 2, 0, 3]);
    });

    test('a full palette rotates, and pushing onto it changes nothing', () => {
        const { theme, events } = rotatedTheme({ maxNumberOfColors: 4 });
        const palette = theme.palette;
        theme.pushNewColor(NEW[1]!);
        theme.pushRandomColor();
        expect(theme.palette).toBe(palette);
        expect(theme.isTransitioning).toBe(false);
        expect(events).toEqual([false]);
        theme.rotateRandomColor({ transitionDuration: 0 });
        expect(theme.activePalette.nColors).toBe(4);
        expect(theme.activePalette.ageOrder).toEqual([2, 3, 0, 1]);
    });

    test('a palette passed to the constructor keeps its ages', () => {
        const palette = new ColorPalette({
            colors: GOLD,
            mode: 'lab',
            nSteps: 10,
        }).rotateOn(NEW[0]!);
        const copied = new Theme({ palette, nSteps: N_STEPS });
        expect(copied.palette).not.toBe(palette);
        expect(copied.palette.nSteps).toBe(N_STEPS);
        expect(copied.palette.ageOrder).toEqual([1, 2, 3, 0]);
        const cut = new Theme({ palette, maxNumberOfColors: 3 });
        expect(cut.activePaletteHexes).toEqual([NEW[0], GOLD[1], GOLD[2]]);
        expect(cut.palette.ageOrder).toEqual([1, 2, 0]);
        // with the theme's settings already, the theme uses the palette itself
        const same = new Theme({ palette, nSteps: 10 });
        expect(same.palette).toBe(palette);
    });

    test('an assigned palette rebuilt with the theme settings keeps its ages', () => {
        const { theme } = makeTheme();
        const palette = new ColorPalette({
            colors: DUSK,
            mode: 'rgb',
            nSteps: 10,
        })
            .rotateOn(NEW[0]!)
            .rotateOn(NEW[1]!);
        theme.palette = palette;
        expect(theme.palette).not.toBe(palette);
        expect(theme.palette.ageOrder).toEqual([2, 3, 0, 1]);
        theme.targetPalette = palette.rotateOn(NEW[2]!);
        expect(theme.targetPalette!.ageOrder).toEqual([3, 0, 1, 2]);
    });

    test('an assigned palette with the same colors and settings but other ages brings its ages', () => {
        const { theme, events } = rotatedTheme();
        const listOrder = () =>
            new ColorPalette({
                colors: theme.activePaletteHexes,
                mode: 'rgb',
                nSteps: N_STEPS,
            });
        const assigned = listOrder();
        theme.palette = assigned;
        expect(theme.palette).toBe(assigned);
        expect(theme.palette.ageOrder).toEqual([0, 1, 2, 3]);
        // the same colors, settings and ages again change nothing
        theme.palette = listOrder();
        theme.targetPalette = listOrder();
        expect(theme.palette).toBe(assigned);
        expect(theme.isTransitioning).toBe(false);
        expect(events).toEqual([false, false]);
        // as a target, it takes the place of the palette the theme is on, with no transition
        const rotated = assigned.rotateOn(NEW[0]!);
        theme.targetPalette = rotated;
        expect(theme.targetPalette).toBeUndefined();
        expect(theme.palette).toBe(rotated);
        expectAtPalette(theme, rotated.scaleColors);
        expect(events).toEqual([false, false, false]);
    });

    test('an assigned target with the same colors as the target but other ages takes its place', () => {
        const { theme, events } = makeTheme();
        const plain = makeTheme().theme;
        // the same hex as DUSK[0], a fraction of a level apart
        const nudged = chroma.rgb(107.2, 47, 160);
        theme.setColors(DUSK, { transitionDuration: 40 });
        plain.setColors([nudged, ...DUSK.slice(1)], { transitionDuration: 40 });
        theme.tick(0);
        plain.tick(0);
        // (reading the colors also caches the target's)
        expect(colorsOf(theme)).not.toEqual(colorsOf(plain));
        const rotated = theme.targetPalette!.rotateOn(nudged);
        theme.targetPalette = rotated;
        expect(theme.targetPalette).toBe(rotated);
        expect(events).toEqual([true, true]);
        for (let k = 1; k < 40; k++) {
            // heading for the new target's own colors, on the same timing
            expect(colorsOf(theme)).toEqual(colorsOf(plain));
            theme.tick(0);
            plain.tick(0);
        }
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette).toBe(rotated);
        // assigned as palette, it ends the transition with its ages
        theme.setColors(GOLD, { transitionDuration: 40 });
        theme.tick(0);
        const gold = theme.targetPalette!.rotateOn(GOLD[0]!);
        theme.palette = gold;
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette).toBe(gold);
        expect(theme.palette.ageOrder).toEqual([1, 2, 3, 0]);
    });
});
