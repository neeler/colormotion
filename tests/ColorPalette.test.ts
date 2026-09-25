import chroma from 'chroma-js';
import { expect, expectTypeOf, test } from 'vitest';
import { ColorPalette } from '../src';

test('constructs a ColorPalette', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette).toBeDefined();
    expectTypeOf(palette).toMatchTypeOf<ColorPalette>();
    expect(palette instanceof ColorPalette).toBe(true);
});

test('handles color loop creation', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(2);
    expect(palette.colors.length).toBe(3);
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
});

test('handles color loop preexistence', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff', '#000'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(2);
    expect(palette.colors.length).toBe(3);
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
});

test('handles empty color array', () => {
    const palette = new ColorPalette({
        colors: [],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(1);
    expect(palette.colors.length).toBe(2);
});

test('newConfig', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(palette.mode).toBe('rgb');
    expect(palette.nSteps).toBe(10);

    const newConfig = palette.newConfig({
        colors: ['red', 'green', 'blue'],
        mode: 'lab',
        nSteps: 100,
    });
    expect(newConfig).toBeDefined();
    expectTypeOf(newConfig).toMatchTypeOf<ColorPalette>();
    expect(newConfig instanceof ColorPalette).toBe(true);
    expect(newConfig).not.toBe(palette);
    expect(newConfig.hexes).toEqual([
        '#ff0000',
        '#008000',
        '#0000ff',
        '#ff0000',
    ]);
    expect(newConfig.mode).toBe('lab');
    expect(newConfig.nSteps).toBe(100);
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(palette.mode).toBe('rgb');
    expect(palette.nSteps).toBe(10);

    const matchingConfig = palette.newConfig({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(matchingConfig).toBeDefined();
    expectTypeOf(matchingConfig).toMatchTypeOf<ColorPalette>();
    expect(matchingConfig instanceof ColorPalette).toBe(true);
    expect(matchingConfig).toBe(palette);

    const justModeChange = palette.newConfig({
        colors: ['#000', '#fff'],
        mode: 'lab',
        nSteps: 10,
    });
    expect(justModeChange).toBeDefined();
    expectTypeOf(justModeChange).toMatchTypeOf<ColorPalette>();
    expect(justModeChange instanceof ColorPalette).toBe(true);
    expect(newConfig).not.toBe(palette);
    expect(justModeChange.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(justModeChange.mode).toBe('lab');
    expect(justModeChange.nSteps).toBe(10);
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(palette.mode).toBe('rgb');
    expect(palette.nSteps).toBe(10);
});

test('newColors', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const newColors = palette.newColors(['red', 'green', 'blue']);
    expect(newColors).toBeDefined();
    expectTypeOf(newColors).toMatchTypeOf<ColorPalette>();
    expect(newColors instanceof ColorPalette).toBe(true);
    expect(newColors).not.toBe(palette);
    expect(newColors.hexes).toEqual([
        '#ff0000',
        '#008000',
        '#0000ff',
        '#ff0000',
    ]);
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const matchingColors = palette.newColors(['#000', '#fff']);
    expect(matchingColors).toBeDefined();
    expectTypeOf(matchingColors).toMatchTypeOf<ColorPalette>();
    expect(matchingColors instanceof ColorPalette).toBe(true);
    expect(matchingColors).toBe(palette);
});

test('newMode', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const newMode = palette.newMode('lab');
    expect(newMode).toBeDefined();
    expectTypeOf(newMode).toMatchTypeOf<ColorPalette>();
    expect(newMode instanceof ColorPalette).toBe(true);
    expect(newMode).not.toBe(palette);
    expect(newMode.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(newMode.mode).toBe('lab');
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(palette.mode).toBe('rgb');

    const matchingMode = palette.newMode('rgb');
    expect(matchingMode).toBeDefined();
    expectTypeOf(matchingMode).toMatchTypeOf<ColorPalette>();
    expect(matchingMode instanceof ColorPalette).toBe(true);
    expect(matchingMode).toBe(palette);
});

test('rotateMode', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const newMode = palette.rotateMode();
    expect(newMode).toBeDefined();
    expectTypeOf(newMode).toMatchTypeOf<ColorPalette>();
    expect(newMode instanceof ColorPalette).toBe(true);
    expect(newMode).not.toBe(palette);
    expect(newMode.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(newMode.mode).toBe('lab');
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);
    expect(palette.mode).toBe('rgb');
});

test('randomizeFrom', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const randomizeFrom = palette.randomizeFrom('red', {
        nColors: 5,
    });
    expect(randomizeFrom).toBeDefined();
    expectTypeOf(randomizeFrom).toMatchTypeOf<ColorPalette>();
    expect(randomizeFrom instanceof ColorPalette).toBe(true);
    expect(randomizeFrom).not.toBe(palette);
    expect(randomizeFrom.nColors).toBe(5);
    expect(palette.nColors).toBe(2);
    expect(randomizeFrom.hexes[0]).toBe('#ff0000');
});

test('randomize', () => {
    const palette = new ColorPalette({
        colors: ['#000', '#fff'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.hexes).toEqual(['#000000', '#ffffff', '#000000']);

    const randomize = palette.randomize({
        nColors: 5,
    });
    expect(randomize).toBeDefined();
    expectTypeOf(randomize).toMatchTypeOf<ColorPalette>();
    expect(randomize instanceof ColorPalette).toBe(true);
    expect(randomize).not.toBe(palette);
    expect(randomize.nColors).toBe(5);
    expect(palette.nColors).toBe(2);
});

test('push', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(3);

    const push = palette.push('#800080');
    expect(push).toBeDefined();
    expectTypeOf(push).toMatchTypeOf<ColorPalette>();
    expect(push instanceof ColorPalette).toBe(true);
    expect(push).not.toBe(palette);
    expect(push.nColors).toBe(4);
    expect(palette.nColors).toBe(3);
    expect(push.hexes).toEqual([
        '#ff0000',
        '#008000',
        '#0000ff',
        '#800080',
        '#ff0000',
    ]);
});

test('pushRandom', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(3);

    const pushRandom = palette.pushRandom();
    expect(pushRandom).toBeDefined();
    expectTypeOf(pushRandom).toMatchTypeOf<ColorPalette>();
    expect(pushRandom instanceof ColorPalette).toBe(true);
    expect(pushRandom).not.toBe(palette);
    expect(pushRandom.nColors).toBe(4);
    expect(palette.nColors).toBe(3);
    expect(pushRandom.hexes[0]).toEqual(palette.hexes[0]);
    expect(pushRandom.hexes[1]).toEqual(palette.hexes[1]);
    expect(pushRandom.hexes[2]).toEqual(palette.hexes[2]);
    expect(pushRandom.hexes[3]).not.toEqual(palette.hexes[3]);
    expect(pushRandom.hexes[4]).toEqual(pushRandom.hexes[0]);

    const paletteWithMaxColors = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
        maxNumberOfColors: 3,
    });

    const pushRandomWithMaxColors = paletteWithMaxColors.pushRandom();
    expect(pushRandomWithMaxColors).toBeDefined();
    expectTypeOf(pushRandomWithMaxColors).toMatchTypeOf<ColorPalette>();
    expect(pushRandomWithMaxColors instanceof ColorPalette).toBe(true);
    expect(pushRandomWithMaxColors).toBe(paletteWithMaxColors);
    expect(pushRandomWithMaxColors.nColors).toBe(3);
});

test('popOldest', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(3);

    const popOldest = palette.popOldest();
    expect(popOldest).toBeDefined();
    expectTypeOf(popOldest).toMatchTypeOf<ColorPalette>();
    expect(popOldest instanceof ColorPalette).toBe(true);
    expect(popOldest).not.toBe(palette);
    expect(popOldest.nColors).toBe(2);
    expect(palette.nColors).toBe(3);
    expect(popOldest.hexes).toEqual(['#008000', '#0000ff', '#008000']);

    const popOldest2 = popOldest.popOldest();
    expect(popOldest2).toBeDefined();
    expectTypeOf(popOldest2).toMatchTypeOf<ColorPalette>();
    expect(popOldest2 instanceof ColorPalette).toBe(true);
    expect(popOldest2).not.toBe(popOldest);
    expect(popOldest2.nColors).toBe(1);
    expect(popOldest.nColors).toBe(2);
    expect(popOldest2.hexes).toEqual(['#0000ff', '#0000ff']);

    const popOldest3 = popOldest2.popOldest();
    expect(popOldest3).toBeDefined();
    expectTypeOf(popOldest3).toMatchTypeOf<ColorPalette>();
    expect(popOldest3 instanceof ColorPalette).toBe(true);
    expect(popOldest3).toBe(popOldest2);
    expect(popOldest3.nColors).toBe(1);
    expect(popOldest3.hexes).toEqual(['#0000ff', '#0000ff']);
});

test('rotateOn', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(3);

    const rotateOn = palette.rotateOn('#800080');
    expect(rotateOn).toBeDefined();
    expectTypeOf(rotateOn).toMatchTypeOf<ColorPalette>();
    expect(rotateOn instanceof ColorPalette).toBe(true);
    expect(rotateOn).not.toBe(palette);
    expect(rotateOn.nColors).toBe(3);
    expect(palette.nColors).toBe(3);
    expect(palette.hexes).toEqual(['#ff0000', '#008000', '#0000ff', '#ff0000']);
    expect(rotateOn.hexes).toEqual([
        '#008000',
        '#0000ff',
        '#800080',
        '#008000',
    ]);
});

test('rotateRandomOn', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    expect(palette.nColors).toBe(3);

    const rotateRandomOn = palette.rotateRandomOn();
    expect(rotateRandomOn).toBeDefined();
    expectTypeOf(rotateRandomOn).toMatchTypeOf<ColorPalette>();
    expect(rotateRandomOn instanceof ColorPalette).toBe(true);
    expect(rotateRandomOn).not.toBe(palette);
    expect(rotateRandomOn.nColors).toBe(3);
    expect(palette.nColors).toBe(3);
    expect(palette.hexes).toEqual(['#ff0000', '#008000', '#0000ff', '#ff0000']);
    expect(rotateRandomOn.hexes[0]).toEqual('#008000');
    expect(rotateRandomOn.hexes[1]).toEqual('#0000ff');
    expect(rotateRandomOn.hexes[3]).toEqual('#008000');
});

test('static random', () => {
    const random = ColorPalette.random({
        nColors: 2,
        mode: 'rgb',
        nSteps: 10,
    });
    expect(random).toBeDefined();
    expectTypeOf(random).toMatchTypeOf<ColorPalette>();
    expect(random instanceof ColorPalette).toBe(true);
    expect(random.nColors).toBe(2);
    expect(random.colors.length).toBe(3);
});

test('maxNumberOfColors', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
        maxNumberOfColors: 3,
    });
    expect(palette.nColors).toBe(3);

    const push = palette.push('#800080');
    expect(push.nColors).toBe(3);
    expect(push.hexes).toEqual(['#ff0000', '#008000', '#0000ff', '#ff0000']);
    expect(push).toBe(palette);

    const paletteAboveMax = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
        maxNumberOfColors: 2,
    });
    expect(paletteAboveMax.nColors).toBe(2);
    expect(paletteAboveMax.hexes).toEqual(['#ff0000', '#008000', '#ff0000']);
});

test('newColors and newConfig cut a long color list as the constructor does', () => {
    // cut to 3, the list ends on its first color, which stays a color of its own
    const colors = ['red', 'blue', 'red', 'green'];
    const config = { mode: 'rgb' as const, nSteps: 10, maxNumberOfColors: 3 };
    const constructed = new ColorPalette({ ...config, colors });
    expect(constructed.hexes).toEqual([
        '#ff0000',
        '#0000ff',
        '#ff0000',
        '#ff0000',
    ]);

    const other = new ColorPalette({ ...config, colors: ['white'] });
    expect(other.newColors(colors).hexes).toEqual(constructed.hexes);
    expect(other.newConfig({ ...config, colors }).hexes).toEqual(
        constructed.hexes,
    );
    // with other settings, the list is cut to the new maxNumberOfColors
    expect(
        other.newConfig({ ...config, colors, maxNumberOfColors: 2, nSteps: 20 })
            .hexes,
    ).toEqual(['#ff0000', '#0000ff', '#ff0000']);
    // and a raised maxNumberOfColors keeps colors the old one would have cut
    expect(
        other.newConfig({ ...config, colors, maxNumberOfColors: 4 }).hexes,
    ).toEqual(['#ff0000', '#0000ff', '#ff0000', '#008000', '#ff0000']);

    // a list whose first colors are the palette's gives back the same palette
    expect(constructed.newColors([...colors, 'yellow'])).toBe(constructed);
    expect(
        constructed.newConfig({ ...config, colors: [...colors, 'yellow'] }),
    ).toBe(constructed);
});

test('clampColors', () => {
    const colors = ['#000', '#fff', '#f00', '#0f0', '#00f'];
    const maxNumberOfColors = 3;
    const clampedColors = ColorPalette.clampColors(colors, maxNumberOfColors);
    expect(clampedColors.length).toBe(3);
    expect(clampedColors).toEqual(['#000', '#fff', '#f00']);

    const colors2 = ['#000', '#fff'];
    const maxNumberOfColors2 = 3;
    const clampedColors2 = ColorPalette.clampColors(
        colors2,
        maxNumberOfColors2,
    );
    expect(clampedColors2.length).toBe(2);
    expect(clampedColors2).toEqual(['#000', '#fff']);
});

test('respects minBrightness', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
    });
    for (let i = 0; i < 100; i++) {
        const minBrightness = 0.7;
        const randomPalette = palette.randomize({
            minBrightness,
        });
        for (const hex of randomPalette.hexes) {
            const color = chroma(hex);
            expect(color.get('hsv.v')).toBeGreaterThanOrEqual(minBrightness);
        }
    }
});

test('derived palettes keep deltaEThreshold and maxNumberOfColors', () => {
    const palette = new ColorPalette({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
        deltaEThreshold: 40,
        maxNumberOfColors: 4,
    });

    const derived = [
        palette.newColors(['pink', 'cyan']),
        palette.newMode('lab'),
        palette.rotateMode(),
        palette.newConfig({ colors: ['pink'], mode: 'lab', nSteps: 20 }),
        palette.randomize(),
        palette.randomizeFrom('red'),
        palette.push('pink'),
        palette.pushRandom(),
        palette.popOldest(),
        palette.rotateOn('pink'),
        palette.rotateRandomOn(),
    ];
    for (const derivedPalette of derived) {
        expect(derivedPalette.deltaEThreshold).toBe(40);
        expect(derivedPalette.maxNumberOfColors).toBe(4);
    }

    const overridden = palette.newConfig({
        colors: ['red', 'green', 'blue'],
        mode: 'rgb',
        nSteps: 10,
        deltaEThreshold: 5,
        maxNumberOfColors: 2,
    });
    expect(overridden).not.toBe(palette);
    expect(overridden.deltaEThreshold).toBe(5);
    expect(overridden.maxNumberOfColors).toBe(2);
    expect(overridden.nColors).toBe(2);
});

test('random palettes respect the default deltaEThreshold', () => {
    for (let i = 0; i < 20; i++) {
        const palette = ColorPalette.random({
            nColors: 5,
            mode: 'rgb',
            nSteps: 10,
        });
        expect(palette.deltaEThreshold).toBe(20);
        for (let iColor = 1; iColor < palette.nColors; iColor++) {
            expect(
                chroma.deltaE(
                    palette.colors[iColor - 1]!,
                    palette.colors[iColor]!,
                    1,
                    1,
                    1,
                ),
            ).toBeGreaterThanOrEqual(20);
        }
    }
});

test('random color generation terminates with an unsatisfiable threshold', () => {
    const palette = new ColorPalette({
        colors: ['white'],
        mode: 'rgb',
        nSteps: 10,
        deltaEThreshold: 100,
    });
    const pushed = palette.pushRandom({ minBrightness: 1 });
    expect(pushed.nColors).toBe(2);
    expect(chroma(pushed.hexes[1]!).get('hsv.v')).toBeGreaterThanOrEqual(0.99);

    const randomized = ColorPalette.random({
        nColors: 3,
        mode: 'rgb',
        nSteps: 10,
        deltaEThreshold: 100,
        minBrightness: 1,
    });
    expect(randomized.nColors).toBe(3);
});

test('scale colors keep full precision and stay distinct for large nSteps', () => {
    const palette = new ColorPalette({
        colors: ['red', 'blue'],
        mode: 'lab',
        nSteps: 20000,
    });
    expect(palette.scaleColors.length).toBe(20000);
    for (let i = 1; i < 200; i++) {
        expect(palette.scaleColors[i]!.rgb(false)).not.toEqual(
            palette.scaleColors[i - 1]!.rgb(false),
        );
    }
    const hasFractionalChannel = palette.scaleColors.some((color) =>
        color.rgb(false).some((channel) => !Number.isInteger(channel)),
    );
    expect(hasFractionalChannel).toBe(true);
    expect(palette.scaleColors[0]!.hex()).toBe('#ff0000');
});

test('random palettes are reproducible with an injected random function', () => {
    const makeRandom = () => {
        let state = 12345;
        return () => {
            state = (state * 1103515245 + 12345) % 2147483648;
            return state / 2147483648;
        };
    };
    const palette1 = ColorPalette.random({
        nColors: 4,
        mode: 'rgb',
        nSteps: 10,
        random: makeRandom(),
    });
    const palette2 = ColorPalette.random({
        nColors: 4,
        mode: 'rgb',
        nSteps: 10,
        random: makeRandom(),
    });
    expect(palette1.hexes).toEqual(palette2.hexes);
    expect(palette1.randomize().hexes).toEqual(palette2.randomize().hexes);
    expect(palette1.newMode('lab').random).toBe(palette1.random);
    expect(palette1.pushRandom().random).toBe(palette1.random);
});
