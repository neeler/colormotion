import chroma from 'chroma-js';
import { expect, expectTypeOf, test } from 'vitest';
import { Theme, ColorPalette } from '../src';

function tickTheme(theme: Theme, n: number) {
    for (let i = 0; i < n; i++) {
        theme.tick();
    }
}

function flushThemeChange(theme: Theme) {
    while (theme.targetPalette) {
        theme.tick();
    }
}

test('constructs a Theme', () => {
    const theme = new Theme();
    expect(theme).toBeDefined();
    expectTypeOf(theme).toMatchTypeOf<Theme>();
    expect(theme instanceof Theme).toBe(true);
});

test('creates a new theme with n random colors', () => {
    const theme = new Theme({
        nColors: 3,
    });
    expect(theme.activePalette.nColors).toBe(3);
});

test('creates a new theme with specific colors', () => {
    const theme = new Theme({
        colors: ['red', 'green', 'blue'],
    });
    expect(theme.activePalette.nColors).toBe(3);
    expect(theme.activePaletteHexes).toEqual(['#ff0000', '#008000', '#0000ff']);
});

test('creates a new theme with a input palette', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    const theme = new Theme({
        palette,
    });
    expect(theme.activePalette).not.toBe(palette);
    expect(theme.activePalette.nColors).toBe(3);
    expect(theme.activePaletteHexes).toEqual(['#ff0000', '#008000', '#0000ff']);
});

test('uses the nSteps of the Theme when initialized with a input palette', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'lab',
        nSteps: 10,
    });
    const theme = new Theme({
        palette,
        nSteps: 1024,
    });
    expect(theme.activePalette).not.toBe(palette);
    expect(theme.activePalette.mode).toBe('lab');
    expect(theme.activePalette.nSteps).toBe(1024);
    expect(theme.activePalette.nColors).toBe(3);
    expect(theme.activePaletteHexes).toEqual(['#ff0000', '#008000', '#0000ff']);
});

test('uses the mode of the Theme when initialized with a input palette', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    const theme = new Theme({
        palette,
        mode: 'lab',
        nSteps: 1024,
    });
    expect(theme.activePalette).not.toBe(palette);
    expect(theme.activePalette.mode).toBe('lab');
    expect(theme.activePalette.nSteps).toBe(1024);
    expect(theme.activePalette.nColors).toBe(3);
    expect(theme.activePaletteHexes).toEqual(['#ff0000', '#008000', '#0000ff']);
});

test('creates a theme with a specific mode', () => {
    const theme = new Theme({
        mode: 'lab',
    });
    expect(theme.activePalette.mode).toBe('lab');
});

test('creates a theme with a max number of colors', () => {
    const theme = new Theme({
        maxNumberOfColors: 7,
    });
    expect(theme.maxNumberOfColors).toBe(7);
});

test('can pop the oldest color', () => {
    const theme = new Theme({
        colors: ['red', 'green', 'blue'],
    });
    theme.popOldestColor();
    expect(theme.activePalette.nColors).toBe(2);
    expect(theme.activePaletteHexes).toEqual(['#008000', '#0000ff']);
});

test('can not pop once down to one color', () => {
    const theme = new Theme({
        colors: ['red', 'green', 'blue'],
    });
    theme.popOldestColor();
    expect(theme.activePalette.nColors).toBe(2);
    expect(theme.activePaletteHexes).toEqual(['#008000', '#0000ff']);

    theme.popOldestColor();

    expect(theme.activePalette.nColors).toBe(1);
    expect(theme.activePaletteHexes).toEqual(['#0000ff']);

    theme.popOldestColor();
    expect(theme.activePalette.nColors).toBe(1);
    expect(theme.activePaletteHexes).toEqual(['#0000ff']);
});

test('always respects max number of colors', () => {
    const theme1 = new Theme({
        nColors: 5,
        maxNumberOfColors: 3,
    });
    expect(theme1.activePalette.nColors).toBe(3);
    expect(theme1.activePalette.maxNumberOfColors).toBe(3);

    const theme2 = new Theme({
        colors: ['red', 'green', 'blue'],
        maxNumberOfColors: 3,
    });
    theme2.pushRandomColor();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.tick();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.randomTheme();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.rotateMode();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.randomTheme({
        nColors: 5,
    });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.rotateRandomColor();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.popOldestColor();
    theme2.pushRandomColor();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.randomTheme();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    tickTheme(theme2, 10);

    theme2.pushRandomColor();
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.popOldestColor();
    expect(theme2.activePalette.nColors).toBe(2);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    tickTheme(theme2, 10);

    theme2.pushRandomColor({ minBrightness: 0.6 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 0.6 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 0.6 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 0.6 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);
});

test('transitions to a new palette and clears transition state', () => {
    const theme = new Theme({ colors: ['red', 'green', 'blue'], nSteps: 64 });
    const events: boolean[] = [];
    theme.subscribe((event) => events.push(event.isTransitioning));

    expect(theme.transitionDistance).toBeUndefined();
    theme.setColors(['purple', 'orange', 'teal']);
    expect(theme.targetPalette).toBeDefined();
    expect(events).toEqual([true]);

    theme.tick();
    expect(theme.transitionDistance).toBeGreaterThan(0);

    flushThemeChange(theme);
    expect(theme.targetPalette).toBeUndefined();
    expect(theme.transitionDistance).toBeUndefined();
    expect(theme.activePaletteHexes).toEqual(['#800080', '#ffa500', '#008080']);
    expect(theme.getColor(-theme.normalizeIndex(0)).hex()).toBe('#800080');
    expect(events).toEqual([true, false]);
});

test('completes a transition whose target colors are already reached', () => {
    // A single-color palette produces identical scale colors in every mode,
    // so the distance to the target is 0 from the start.
    const theme = new Theme({ colors: ['red'], nSteps: 64 });
    theme.setMode('lab');
    expect(theme.targetPalette).toBeDefined();

    theme.tick();
    expect(theme.targetPalette).toBeUndefined();
    expect(theme.mode).toBe('lab');
    expect(theme.activePalette.mode).toBe('lab');
});

test('retargeting mid-transition ends on the latest palette', () => {
    const theme = new Theme({ colors: ['red', 'green', 'blue'], nSteps: 64 });
    theme.setColors(['purple', 'orange', 'teal']);
    tickTheme(theme, 20);
    const midDistance = theme.transitionDistance;
    expect(midDistance).toBeGreaterThan(0);

    theme.setColors(['white', 'black']);
    expect(theme.transitionDistance).toBeUndefined();
    expect(theme.palette.hexes).toEqual([
        '#ff0000',
        '#008000',
        '#0000ff',
        '#ff0000',
    ]);

    flushThemeChange(theme);
    expect(theme.activePaletteHexes).toEqual(['#ffffff', '#000000']);
    expect(theme.palette).toBe(theme.activePalette);
});

test('keeps deltaEThreshold across palette changes', () => {
    const theme = new Theme({
        colors: ['red', 'blue'],
        nSteps: 64,
        deltaEThreshold: 40,
    });
    expect(theme.activePalette.deltaEThreshold).toBe(40);

    theme.setColors(['green', 'yellow']);
    expect(theme.activePalette.deltaEThreshold).toBe(40);
    theme.setMode('lab');
    expect(theme.activePalette.deltaEThreshold).toBe(40);
    theme.rotateMode();
    expect(theme.activePalette.deltaEThreshold).toBe(40);
    theme.update({ colors: ['pink', 'cyan'], mode: 'hsl' });
    expect(theme.activePalette.deltaEThreshold).toBe(40);
    theme.randomTheme();
    expect(theme.activePalette.deltaEThreshold).toBe(40);
    theme.pushRandomColor();
    expect(theme.activePalette.deltaEThreshold).toBe(40);
});

test('inherits settings from an input palette', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 64,
        deltaEThreshold: 35,
        maxNumberOfColors: 4,
    });
    const theme = new Theme({ palette });
    expect(theme.maxNumberOfColors).toBe(4);
    expect(theme.activePalette.maxNumberOfColors).toBe(4);
    expect(theme.activePalette.deltaEThreshold).toBe(35);

    const overridden = new Theme({ palette, deltaEThreshold: 10 });
    expect(overridden.activePalette.deltaEThreshold).toBe(10);
});

test('wraps indexes around the color wheel', () => {
    const theme = new Theme({ colors: ['red', 'green', 'blue'], nSteps: 64 });
    expect(theme.normalizeIndex(0)).toBe(0);
    expect(theme.normalizeIndex(64)).toBe(0);
    expect(theme.normalizeIndex(-1)).toBe(63);
    expect(theme.normalizeIndex(65.4)).toBe(1);
    expect(theme.getColor(-64).hex()).toBe(theme.getColor(0).hex());

    theme.tick(10);
    expect(theme.normalizeIndex(0)).toBe(10);
    theme.tick(-20);
    expect(theme.normalizeIndex(0)).toBe(54);
    theme.tick(64 * 1000);
    expect(theme.normalizeIndex(0)).toBe(54);
});

test('getColor applies global and per-call brightness', () => {
    const theme = new Theme({ colors: ['white'], nSteps: 64 });
    expect(theme.getColor(0).hex()).toBe('#ffffff');
    expect(theme.getColor(0, { brightness: 1 }).hex()).toBe('#ffffff');

    const dimmedCall = theme.getColor(0, { brightness: 0.5 });
    expect(dimmedCall.get('lab.l')).toBeLessThan(100);

    theme.brightness = 0.5;
    expect(theme.brightness).toBe(0.5);
    const dimmedGlobal = theme.getColor(0);
    expect(dimmedGlobal.hex()).toBe(dimmedCall.hex());

    const dimmedBoth = theme.getColor(0, { brightness: 0.5 });
    expect(dimmedBoth.get('lab.l')).toBeLessThan(dimmedGlobal.get('lab.l'));

    theme.brightness = 5;
    expect(theme.brightness).toBe(1);
    theme.brightness = -1;
    expect(theme.brightness).toBe(0);
});

test('publishes brightness changes to subscribers', () => {
    const theme = new Theme({ colors: ['red', 'blue'], nSteps: 64 });
    const brightnesses: number[] = [];
    const callback = (event: { brightness: number }) =>
        brightnesses.push(event.brightness);

    const status = theme.subscribe(callback);
    expect(status.brightness).toBe(1);
    expect(status.isTransitioning).toBe(false);
    expect(status.palette).toBe(theme.activePalette);

    theme.brightness = 0.4;
    theme.brightness = 0.4;
    theme.brightness = 0.8;
    expect(brightnesses).toEqual([0.4, 0.8]);

    theme.unsubscribe(callback);
    theme.brightness = 0.2;
    expect(brightnesses).toEqual([0.4, 0.8]);
});

test('transitionDistance tracks the full average distance', () => {
    const theme = new Theme({ colors: ['red', 'green', 'blue'] });
    theme.setColors(['purple', 'orange', 'teal']);
    theme.tick();
    const target = theme.targetPalette!;
    const offset = theme.normalizeIndex(0);
    let sum = 0;
    for (let i = 0; i < theme.nSteps; i++) {
        sum += chroma.deltaE(
            target.scaleColors[i]!,
            theme.getColor(i - offset),
            1,
            1,
            1,
        );
    }
    const fullAverage = sum / theme.nSteps;
    expect(Math.abs(theme.transitionDistance! - fullAverage)).toBeLessThan(0.5);
});
