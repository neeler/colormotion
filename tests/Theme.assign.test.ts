import { describe, expect, test } from 'vitest';
import {
    ColorPalette,
    InterpolationMode,
    Theme,
    ThemeUpdateEvent,
} from '../src';

const N_STEPS = 32;
const START = ['red', 'blue'];

function makeTheme() {
    const theme = new Theme({ colors: START, nSteps: N_STEPS });
    const events: ThemeUpdateEvent[] = [];
    theme.subscribe((event) => events.push(event));
    return { theme, events };
}

function makePalette(
    colors: string[],
    config: {
        mode?: InterpolationMode;
        nSteps?: number;
        maxNumberOfColors?: number;
    } = {},
) {
    return new ColorPalette({
        colors,
        mode: 'rgb',
        nSteps: N_STEPS,
        ...config,
    });
}

/** Every color the theme shows now, unrounded. */
function colorsOf(theme: Theme) {
    return Array.from({ length: N_STEPS }, (_, i) =>
        theme.getColor(i).rgba(false),
    );
}

/** The palette's colors at the steps getColor reads, which tick() turns. */
const scaleOf = (palette: ColorPalette, theme: Theme) =>
    Array.from({ length: N_STEPS }, (_, i) =>
        palette.scaleColors[theme.normalizeIndex(i)]!.rgba(false),
    );

const transitioning = (events: ThemeUpdateEvent[]) =>
    events.map((event) => event.isTransitioning);

/** Ticks the theme until it is not transitioning, and returns how many ticks that took. */
function ticksToFinish(theme: Theme) {
    let ticks = 0;
    for (; theme.isTransitioning; ticks++) {
        expect(ticks).toBeLessThan(5000);
        theme.tick();
    }
    return ticks;
}

/** Ticks both themes until neither is transitioning, checking they show the same colors on every tick. */
function tickInLockstep(a: Theme, b: Theme) {
    for (let ticks = 0; a.isTransitioning || b.isTransitioning; ticks++) {
        expect(colorsOf(a)).toEqual(colorsOf(b));
        expect(ticks).toBeLessThan(5000);
        a.tick();
        b.tick();
    }
    expect(colorsOf(a)).toEqual(colorsOf(b));
}

describe('assigning theme.palette', () => {
    test('puts the theme at rest on it at once', () => {
        const { theme, events } = makeTheme();
        const palette = makePalette(['green', 'yellow'], { mode: 'lab' });
        theme.palette = palette;
        expect(theme.palette).toBe(palette);
        expect(theme.activePalette).toBe(palette);
        expect(theme.isTransitioning).toBe(false);
        expect(theme.mode).toBe('lab');
        expect(colorsOf(theme)).toEqual(scaleOf(palette, theme));
        expect(transitioning(events)).toEqual([false]);
        expect(events[0]!.palette).toBe(palette);
        expect(events[0]!.mode).toBe('lab');
    });

    test('is the same as update with a transitionDuration of 0, from the same wheel position', () => {
        const assigned = makeTheme();
        const updated = makeTheme();
        for (const { theme } of [assigned, updated]) {
            theme.setColors(['white', 'black']);
            theme.tick(5);
        }
        assigned.theme.palette = makePalette(['green', 'yellow'], {
            mode: 'lab',
        });
        updated.theme.update({
            colors: ['green', 'yellow'],
            mode: 'lab',
            transitionDuration: 0,
        });
        expect(assigned.theme.normalizeIndex(0)).toBe(5);
        expect(colorsOf(assigned.theme)).toEqual(colorsOf(updated.theme));
        expect(assigned.events.map((event) => event.mode)).toEqual(
            updated.events.map((event) => event.mode),
        );
    });

    test('ends a transition at its target when assigned the target', () => {
        const { theme, events } = makeTheme();
        theme.setColors(['white', 'black']);
        theme.tick();
        const target = theme.targetPalette!;
        theme.palette = target;
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette).toBe(target);
        expect(colorsOf(theme)).toEqual(scaleOf(target, theme));
        expect(transitioning(events)).toEqual([true, false]);
    });

    test('a timed transition after it has its own length', () => {
        const { theme } = makeTheme();
        theme.update({ colors: ['white', 'black'], transitionDuration: 10 });
        for (let i = 0; i < 5; i++) theme.tick();
        theme.palette = makePalette(['green', 'yellow']);
        theme.update({ colors: ['orange', 'purple'], transitionDuration: 4 });
        expect(ticksToFinish(theme)).toBe(4);
    });

    test('ends a transition in progress', () => {
        const { theme, events } = makeTheme();
        theme.setMode('hsl');
        theme.tick();
        const palette = makePalette(['green', 'yellow']);
        theme.palette = palette;
        expect(theme.isTransitioning).toBe(false);
        expect(theme.targetPalette).toBeUndefined();
        expect(theme.transitionDistance).toBeUndefined();
        expect(theme.mode).toBe('rgb');
        expect(colorsOf(theme)).toEqual(scaleOf(palette, theme));
        expect(transitioning(events)).toEqual([true, false]);
        expect(events[1]!.mode).toBe('rgb');
    });

    test('returns to the palette a transition is leaving', () => {
        const { theme } = makeTheme();
        const start = theme.palette;
        theme.setColors(['white', 'black']);
        theme.tick();
        theme.palette = start;
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette).toBe(start);
        expect(colorsOf(theme)).toEqual(scaleOf(start, theme));
    });

    test('changes nothing when the theme is already at rest on it', () => {
        const { theme, events } = makeTheme();
        theme.palette = theme.palette;
        // a new palette with the same colors and settings, as when a look is rebuilt from data
        theme.palette = makePalette(START);
        expect(events).toEqual([]);
    });

    test('the same palette assigned again is the same copy, and changes nothing', () => {
        const { theme, events } = makeTheme();
        const palette = makePalette(['green', 'yellow'], { nSteps: 10 });
        theme.palette = palette;
        const copy = theme.palette;
        theme.palette = palette;
        expect(theme.palette).toBe(copy);
        expect(events).toHaveLength(1);
    });

    test('a subscriber that assigns a fixed palette settles', () => {
        const { theme } = makeTheme();
        const pinned = makePalette(['green', 'yellow'], { nSteps: 10 });
        let calls = 0;
        theme.subscribe(() => {
            calls++;
            theme.palette = pinned;
        });
        theme.setColors(['white', 'black']);
        expect(calls).toBeLessThan(5);
        expect(theme.isTransitioning).toBe(false);
        expect(theme.activePaletteHexes).toEqual(['#008000', '#ffff00']);
    });

    test("rebuilds a palette with the theme's nSteps but another maxNumberOfColors", () => {
        const { theme } = makeTheme();
        const palette = makePalette(['green', 'yellow'], {
            maxNumberOfColors: 2,
        });
        theme.palette = palette;
        expect(theme.palette).not.toBe(palette);
        expect(theme.palette.maxNumberOfColors).toBe(theme.maxNumberOfColors);
        // the theme's limit applies from now on, not the palette's
        theme.pushNewColor('white', { transitionDuration: 0 });
        expect(theme.activePaletteHexes).toEqual([
            '#008000',
            '#ffff00',
            '#ffffff',
        ]);
    });

    test("rebuilds a palette with other nSteps or maxNumberOfColors with the theme's", () => {
        const { theme } = makeTheme();
        const random = () => 0.25;
        const palette = new ColorPalette({
            colors: ['green', 'yellow', 'white'],
            mode: 'lab',
            nSteps: 10,
            maxNumberOfColors: 2,
            deltaEThreshold: 40,
            random,
        });
        theme.palette = palette;
        expect(theme.palette).not.toBe(palette);
        expect(theme.palette.nSteps).toBe(N_STEPS);
        expect(theme.palette.maxNumberOfColors).toBe(theme.maxNumberOfColors);
        expect(theme.palette.mode).toBe('lab');
        expect(theme.palette.deltaEThreshold).toBe(40);
        expect(theme.palette.random).toBe(random);
        expect(theme.activePaletteHexes).toEqual(palette.hexes.slice(0, -1));
        expect(colorsOf(theme)).toEqual(scaleOf(theme.palette, theme));

        // the theme keeps working: this used to throw on the first tick
        theme.setColors(['white', 'black']);
        for (let ticks = 0; theme.isTransitioning; ticks++) {
            expect(ticks).toBeLessThan(5000);
            theme.tick();
        }
        expect(theme.activePaletteHexes).toEqual(['#ffffff', '#000000']);
    });
});

describe('assigning theme.targetPalette', () => {
    test('transitions to it at the default speed, as update does', () => {
        const assigned = makeTheme();
        const updated = makeTheme();
        const palette = makePalette(['green', 'yellow'], { mode: 'lab' });
        assigned.theme.targetPalette = palette;
        updated.theme.update({ colors: ['green', 'yellow'], mode: 'lab' });
        expect(assigned.theme.targetPalette).toBe(palette);
        expect(assigned.theme.mode).toBe('lab');
        tickInLockstep(assigned.theme, updated.theme);
        expect(assigned.theme.palette).toBe(palette);
        expect(transitioning(assigned.events)).toEqual(
            transitioning(updated.events),
        );
    });

    test('retargets a transition in progress from where the colors are', () => {
        const assigned = makeTheme();
        const updated = makeTheme();
        for (const { theme } of [assigned, updated]) {
            theme.setColors(['white', 'black']);
            theme.tick();
            theme.tick();
        }
        assigned.theme.targetPalette = makePalette(['green', 'yellow']);
        updated.theme.setColors(['green', 'yellow']);
        tickInLockstep(assigned.theme, updated.theme);
    });

    test('turns back to the palette a transition is leaving, as setColors does', () => {
        const assigned = makeTheme();
        const set = makeTheme();
        for (const { theme } of [assigned, set]) {
            theme.setColors(['white', 'black']);
            theme.tick();
            theme.getColor(0); // a color read mid-transition must not keep heading for the old target
        }
        const start = assigned.theme.palette;
        assigned.theme.targetPalette = start;
        set.theme.setColors(START);
        expect(assigned.theme.isTransitioning).toBe(true);
        expect(assigned.theme.targetPalette).toBe(start);
        tickInLockstep(assigned.theme, set.theme);
        expect(assigned.theme.palette).toBe(start);
    });

    test('rebuilds a palette with another nSteps, and the transition runs to the end', () => {
        const { theme } = makeTheme();
        theme.targetPalette = makePalette(['green', 'yellow'], { nSteps: 10 });
        for (let ticks = 0; theme.isTransitioning; ticks++) {
            expect(ticks).toBeLessThan(5000);
            expect(theme.getColor(N_STEPS - 1)).toBeDefined();
            theme.tick();
        }
        expect(theme.palette.nSteps).toBe(N_STEPS);
        expect(theme.activePaletteHexes).toEqual(['#008000', '#ffff00']);
    });

    test('undefined cancels a transition: the theme returns to palette at once', () => {
        const { theme, events } = makeTheme();
        const start = theme.palette;
        theme.update({
            colors: ['white', 'black'],
            mode: 'hsl',
            transitionDuration: 10,
        });
        theme.tick();
        theme.tick();
        theme.targetPalette = undefined;
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette).toBe(start);
        expect(theme.mode).toBe('rgb');
        expect(theme.transitionDistance).toBeUndefined();
        expect(colorsOf(theme)).toEqual(scaleOf(start, theme));
        expect(transitioning(events)).toEqual([true, false]);
        expect(events[1]!.mode).toBe('rgb');
        expect(theme.normalizeIndex(0)).toBe(2); // the wheel stays where it is

        // and the next transition starts from the palette
        theme.setColors(['white', 'black'], { transitionDuration: 0 });
        expect(theme.activePaletteHexes).toEqual(['#ffffff', '#000000']);
    });

    test('the palette it is heading to changes nothing, and keeps the timing', () => {
        const { theme, events } = makeTheme();
        theme.update({ colors: ['white', 'black'], transitionDuration: 10 });
        theme.tick();
        const target = theme.targetPalette!;
        theme.targetPalette = target;
        // an equal palette rebuilt from data is the same target
        theme.targetPalette = makePalette(['white', 'black']);
        expect(theme.targetPalette).toBe(target);
        expect(transitioning(events)).toEqual([true]);
        expect(ticksToFinish(theme)).toBe(9);
    });

    test("the same palette assigned again, rebuilt with the theme's nSteps, changes nothing", () => {
        const { theme, events } = makeTheme();
        const palette = makePalette(['green', 'yellow'], { nSteps: 10 });
        theme.targetPalette = palette;
        theme.tick();
        const target = theme.targetPalette;
        theme.targetPalette = palette;
        expect(theme.targetPalette).toBe(target);
        expect(transitioning(events)).toEqual([true]);
    });

    test('the palette it is at rest on changes nothing', () => {
        const { theme, events } = makeTheme();
        theme.targetPalette = theme.palette;
        theme.targetPalette = makePalette(START);
        expect(theme.isTransitioning).toBe(false);
        expect(events).toEqual([]);
    });

    test('undefined changes nothing when the theme is not transitioning', () => {
        const { theme, events } = makeTheme();
        theme.targetPalette = undefined;
        expect(events).toEqual([]);
    });
});

describe('assigning theme.mode', () => {
    test('is the same as setMode', () => {
        const assigned = makeTheme();
        const set = makeTheme();
        assigned.theme.mode = 'oklch';
        set.theme.setMode('oklch');
        expect(assigned.theme.mode).toBe('oklch');
        expect(assigned.theme.targetPalette?.key).toBe(
            set.theme.targetPalette?.key,
        );
        tickInLockstep(assigned.theme, set.theme);
        expect(assigned.theme.palette.mode).toBe('oklch');
        expect(transitioning(assigned.events)).toEqual(
            transitioning(set.events),
        );
    });

    test('is the same as setMode during a transition', () => {
        const assigned = makeTheme();
        const set = makeTheme();
        for (const { theme } of [assigned, set]) {
            theme.setColors(['white', 'black']);
            theme.tick();
        }
        assigned.theme.mode = 'hsl';
        set.theme.setMode('hsl');
        tickInLockstep(assigned.theme, set.theme);
        expect(assigned.theme.palette.mode).toBe('hsl');
    });

    test('changes nothing when it is already the mode', () => {
        const { theme, events } = makeTheme();
        theme.mode = theme.mode;
        expect(events).toEqual([]);
        expect(theme.isTransitioning).toBe(false);
    });
});
