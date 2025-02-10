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

    theme2.pushRandomColor({ minBrightness: 150 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 150 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 150 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);

    theme2.pushRandomColor({ minBrightness: 150 });
    expect(theme2.activePalette.nColors).toBe(3);
    expect(theme2.activePalette.maxNumberOfColors).toBe(3);
});
