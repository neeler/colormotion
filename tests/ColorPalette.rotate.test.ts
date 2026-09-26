import chroma from 'chroma-js';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { ColorPalette, ColorPaletteConfig, InterpolationModes } from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f'];
const NEW = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e', '#0f5c4a'];
const N_STEPS = 64;

function makePalette(
    colors: string[] = GOLD,
    config: Partial<
        Omit<ColorPaletteConfig, 'colors' | 'normalizedColors'>
    > = {},
) {
    return new ColorPalette({
        colors,
        mode: 'rgb',
        nSteps: N_STEPS,
        ...config,
    });
}

/** The palette's colors without the closing repeat of the first. */
const hexesOf = (palette: ColorPalette) => palette.hexes.slice(0, -1);

/**
 * Small seeded PRNG (mulberry32) for reproducible palettes in tests.
 */
function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A random function that returns the values given, over and over. */
function scripted(values: number[]) {
    let i = 0;
    return () => values[i++ % values.length]!;
}

/** The random values ColorPalette draws a color from: brightness (HSV value), hue and saturation. */
const hsvDraw = (h: number, s: number, v: number) => [v, h / 360, s];

const deltaE = (a: chroma.Color | string, b: chroma.Color | string) =>
    chroma.deltaE(a, b, 1, 1, 1);

describe('rotateOn replaces the oldest color in place', () => {
    test('successive rotations replace a new palette first in, first out', () => {
        let palette = makePalette(GOLD.slice(0, 3));
        expect(palette.ageOrder).toEqual([0, 1, 2]);
        const expected: [string[], number[]][] = [
            [
                [NEW[0]!, GOLD[1]!, GOLD[2]!],
                [1, 2, 0],
            ],
            [
                [NEW[0]!, NEW[1]!, GOLD[2]!],
                [2, 0, 1],
            ],
            [
                [NEW[0]!, NEW[1]!, NEW[2]!],
                [0, 1, 2],
            ],
            [
                [NEW[3]!, NEW[1]!, NEW[2]!],
                [1, 2, 0],
            ],
            [
                [NEW[3]!, NEW[4]!, NEW[2]!],
                [2, 0, 1],
            ],
        ];
        // n + 2 rotations: once round, and on
        expected.forEach(([hexes, ageOrder], i) => {
            palette = palette.rotateOn(NEW[i]!);
            expect(hexesOf(palette)).toEqual(hexes);
            expect(palette.ageOrder).toEqual(ageOrder);
            expect(palette.nColors).toBe(3);
        });
    });

    test('the closing repeat follows a replaced first color', () => {
        const rotated = makePalette().rotateOn(NEW[0]!);
        expect(rotated.hexes).toEqual([NEW[0], ...GOLD.slice(1), NEW[0]]);
        expect(rotated.colors[rotated.nColors]).toBe(rotated.colors[0]);
        expect(rotated.scaleColors[0]!.hex()).toBe(NEW[0]);
        // and the wheel runs from the last color back to the new first one
        expect(rotated.scaleColors[N_STEPS - 1]!.hex()).toBe(
            chroma.mix(GOLD[3]!, NEW[0]!, 15 / 16, 'rgb').hex(),
        );
    });

    for (const mode of Object.values(InterpolationModes)) {
        test(`the scale changes only between the replaced color's neighbours (${mode})`, () => {
            // four colors over 64 steps: stops at 0, 16, 32 and 48, and the first again at 64
            let palette = makePalette(GOLD, { mode });
            [0, 1, 2, 3, 0].forEach((replaced, rotation) => {
                expect(palette.ageOrder[0]).toBe(replaced);
                const rotated = palette.rotateOn(NEW[rotation]!);
                const from = ((replaced + 3) % 4) * 16;
                const to = ((replaced + 1) % 4) * 16;
                // the steps strictly between the neighbours, around the wheel
                const inSpan = (step: number) =>
                    from < to
                        ? step > from && step < to
                        : step > from || step < to;
                let changed = 0;
                for (let step = 0; step < N_STEPS; step++) {
                    const before = palette.scaleColors[step]!.rgba(false);
                    const after = rotated.scaleColors[step]!.rgba(false);
                    if (inSpan(step)) {
                        changed += Number(
                            before.some((v, k) => v !== after[k]),
                        );
                    } else {
                        expect(after, `step ${step}`).toEqual(before);
                    }
                }
                expect(changed).toBe(31);
                // every other color keeps its position, as the same color
                for (let i = 0; i < 4; i++) {
                    if (i !== replaced) {
                        expect(rotated.colors[i]).toBe(palette.colors[i]);
                    }
                }
                palette = rotated;
            });
        });
    }

    test('keeps the other colors at full precision', () => {
        const colors = [
            chroma.oklch(0.6, 0.15, 30),
            chroma.oklch(0.7, 0.1, 150),
            chroma.oklch(0.5, 0.2, 270),
        ];
        const palette = new ColorPalette({ colors, mode: 'oklch', nSteps: 30 });
        const rotated = palette.rotateOn('white');
        expect(rotated.colors[1]!.rgba(false)).toEqual(
            palette.colors[1]!.rgba(false),
        );
        expect(
            rotated.colors[2]!.rgb(false).some((v) => !Number.isInteger(v)),
        ).toBe(true);
    });

    test('never takes a color for the closing repeat', () => {
        // the last color replaced by the first, and the first by the last: still three colors
        const palette = makePalette(['red', 'green', 'blue']);
        const firstAtEnd = palette.rotateOn('#00ff00').rotateOn('#ffff00');
        expect(hexesOf(firstAtEnd)).toEqual(['#00ff00', '#ffff00', '#0000ff']);
        const lastAtEnd = firstAtEnd.rotateOn('#00ff00');
        expect(lastAtEnd.nColors).toBe(3);
        expect(lastAtEnd.hexes).toEqual([
            '#00ff00',
            '#ffff00',
            '#00ff00',
            '#00ff00',
        ]);
        const lastAtStart = palette.rotateOn('blue');
        expect(lastAtStart.nColors).toBe(3);
        expect(hexesOf(lastAtStart)).toEqual(['#0000ff', '#008000', '#0000ff']);
    });

    test('the oldest color replaced by the same color still becomes the newest', () => {
        const palette = makePalette(['red', 'green', 'blue']);
        const same = palette.rotateOn('red');
        expect(same).not.toBe(palette);
        expect(same.key).toBe(palette.key);
        expect(same.ageOrder).toEqual([1, 2, 0]);
        expect(same.rotateOn('#800080').hexes[1]).toBe('#800080');
    });

    test('a single color replaced by itself gives back the same palette', () => {
        const palette = makePalette(['red']);
        expect(palette.rotateOn('#ff0000')).toBe(palette);
        const rotated = palette.rotateOn('blue');
        expect(rotated.hexes).toEqual(['#0000ff', '#0000ff']);
        expect(rotated.ageOrder).toEqual([0]);
    });

    test('keeps the settings and a full palette full', () => {
        const random = seededRandom(3);
        const palette = makePalette(GOLD, {
            mode: 'lab',
            maxNumberOfColors: 4,
            deltaEThreshold: 30,
            random,
        });
        const rotated = palette.rotateOn(NEW[0]!).rotateRandomOn();
        expect(rotated.nColors).toBe(4);
        expect(rotated.mode).toBe('lab');
        expect(rotated.nSteps).toBe(N_STEPS);
        expect(rotated.maxNumberOfColors).toBe(4);
        expect(rotated.deltaEThreshold).toBe(30);
        expect(rotated.random).toBe(random);
        // pushing onto the full palette changes nothing, ages included
        expect(rotated.push(NEW[1]!)).toBe(rotated);
        expect(rotated.pushRandom()).toBe(rotated);
    });
});

describe('ageOrder', () => {
    test('is the list order for a palette built from a list', () => {
        const random = seededRandom(1);
        const palette = makePalette(GOLD, { random });
        const built = [
            palette,
            makePalette(['red', 'green', 'blue', 'red']),
            palette.newColors(NEW.slice(0, 5)),
            palette.newConfig({ colors: NEW, mode: 'lab', nSteps: 10 }),
            palette.randomize({ nColors: 5 }),
            palette.randomizeFrom('red', { nColors: 6 }),
            ColorPalette.random({ nColors: 7, mode: 'rgb', nSteps: 10 }),
        ];
        for (const each of built) {
            expect(each.ageOrder).toEqual(
                Array.from({ length: each.nColors }, (_, i) => i),
            );
        }
        // a list cut to maxNumberOfColors, too
        expect(makePalette(NEW, { maxNumberOfColors: 3 }).ageOrder).toEqual([
            0, 1, 2,
        ]);
    });

    test('is read-only', () => {
        const palette = makePalette().rotateOn('red');
        expect(Object.isFrozen(palette.ageOrder)).toBe(true);
        expect(Object.isFrozen(makePalette().ageOrder)).toBe(true);
        expect(() => {
            (palette.ageOrder as number[])[0] = 3;
        }).toThrow();
        expect(palette.ageOrder).toEqual([1, 2, 3, 0]);
    });

    test('is kept by the identity shortcut', () => {
        const rotated = makePalette(GOLD, { maxNumberOfColors: 4 })
            .rotateOn(NEW[0]!)
            .rotateOn(NEW[1]!);
        expect(rotated.ageOrder).toEqual([2, 3, 0, 1]);
        const hexes = hexesOf(rotated);
        const same = [
            rotated.newColors(hexes),
            rotated.newColors(rotated.hexes),
            rotated.newColors([...hexes, 'white']), // cut back to these colors
            rotated.newConfig({ colors: hexes, mode: 'rgb', nSteps: N_STEPS }),
            rotated.newMode('rgb'),
        ];
        for (const each of same) {
            expect(each).toBe(rotated);
            expect(each.ageOrder).toEqual([2, 3, 0, 1]);
        }
    });

    test('is kept by newMode, rotateMode and newConfig with the same colors', () => {
        const rotated = makePalette().rotateOn(NEW[0]!);
        const kept = [
            rotated.newMode('oklch'),
            rotated.rotateMode(),
            rotated.newConfig({
                colors: rotated.colors,
                mode: 'lab',
                nSteps: N_STEPS,
            }),
            rotated.newConfig({
                colors: hexesOf(rotated),
                mode: 'rgb',
                nSteps: 2048,
            }),
            rotated.newConfig({
                colors: rotated.colors,
                mode: 'rgb',
                nSteps: N_STEPS,
                deltaEThreshold: 5,
            }),
        ];
        for (const each of kept) {
            expect(each).not.toBe(rotated);
            expect(each.key).toBe(rotated.key);
            expect(each.ageOrder).toEqual([1, 2, 3, 0]);
            // so the next rotation replaces the same color
            expect(hexesOf(each.rotateOn('white'))).toEqual([
                NEW[0],
                '#ffffff',
                GOLD[2],
                GOLD[3],
            ]);
        }
        // other colors take their list order
        expect(
            rotated.newConfig({ colors: GOLD, mode: 'lab', nSteps: 10 })
                .ageOrder,
        ).toEqual([0, 1, 2, 3]);
    });

    test('a lower maxNumberOfColors keeps the ages of the colors it keeps', () => {
        const rotated = makePalette().rotateOn(NEW[0]!);
        expect(rotated.ageOrder).toEqual([1, 2, 3, 0]);
        const cut = rotated.newConfig({
            colors: rotated.colors,
            mode: 'rgb',
            nSteps: N_STEPS,
            maxNumberOfColors: 3,
        });
        expect(hexesOf(cut)).toEqual([NEW[0], GOLD[1], GOLD[2]]);
        expect(cut.ageOrder).toEqual([1, 2, 0]);
        const raised = rotated.newConfig({
            colors: rotated.colors,
            mode: 'rgb',
            nSteps: N_STEPS,
            maxNumberOfColors: 10,
        });
        expect(raised.ageOrder).toEqual([1, 2, 3, 0]);
    });
});

describe('push and popOldest', () => {
    test('push adds the newest color at the end, and rotations reach it last', () => {
        const pushed = makePalette(GOLD.slice(0, 3))
            .rotateOn(NEW[0]!)
            .push(NEW[1]!);
        expect(hexesOf(pushed)).toEqual([NEW[0], GOLD[1], GOLD[2], NEW[1]]);
        expect(pushed.ageOrder).toEqual([1, 2, 0, 3]);

        const steps: [number, number[]][] = [
            [1, [2, 0, 3, 1]],
            [2, [0, 3, 1, 2]],
            [0, [3, 1, 2, 0]],
            [3, [1, 2, 0, 3]],
        ];
        let palette = pushed;
        steps.forEach(([replaced, ageOrder], i) => {
            const color = NEW[i + 2]!;
            palette = palette.rotateOn(color);
            expect(palette.hexes[replaced]).toBe(color);
            expect(palette.ageOrder).toEqual(ageOrder);
        });
        expect(hexesOf(palette)).toEqual([NEW[4], NEW[2], NEW[3], NEW[5]]);
    });

    test('push adds a color that matches the first', () => {
        const pushed = makePalette(['red', 'green']).push('red');
        expect(pushed.hexes).toEqual([
            '#ff0000',
            '#008000',
            '#ff0000',
            '#ff0000',
        ]);
        expect(pushed.ageOrder).toEqual([0, 1, 2]);
    });

    test('popOldest drops the oldest color by age, and the rest keep their order', () => {
        let palette = makePalette().rotateOn(NEW[0]!).rotateOn(NEW[1]!);
        expect(hexesOf(palette)).toEqual([NEW[0], NEW[1], GOLD[2], GOLD[3]]);
        expect(palette.ageOrder).toEqual([2, 3, 0, 1]);

        const steps: [string[], number[]][] = [
            [
                [NEW[0]!, NEW[1]!, GOLD[3]!],
                [2, 0, 1],
            ],
            [
                [NEW[0]!, NEW[1]!],
                [0, 1],
            ],
            [[NEW[1]!], [0]],
        ];
        for (const [hexes, ageOrder] of steps) {
            palette = palette.popOldest();
            expect(hexesOf(palette)).toEqual(hexes);
            expect(palette.ageOrder).toEqual(ageOrder);
            expect(palette.hexes[palette.nColors]).toBe(hexes[0]);
        }
        expect(palette.popOldest()).toBe(palette);
    });

    test('popOldest keeps the other colors, even one that matches the new first', () => {
        const palette = makePalette(['red', 'green', 'blue', 'green']);
        const popped = palette.popOldest();
        expect(popped.hexes).toEqual([
            '#008000',
            '#0000ff',
            '#008000',
            '#008000',
        ]);
        expect(popped.colors[0]).toBe(palette.colors[1]);
    });
});

describe('rotateRandomOn', () => {
    test("draws the new color deltaEThreshold from both of the replaced color's neighbours", () => {
        for (const deltaEThreshold of [10, 20, 35]) {
            let palette = makePalette(GOLD, {
                deltaEThreshold,
                random: seededRandom(deltaEThreshold),
            });
            for (let rotation = 0; rotation < 40; rotation++) {
                const replaced = palette.ageOrder[0]!;
                const rotated = palette.rotateRandomOn();
                const color = rotated.colors[replaced]!;
                for (const neighbour of [
                    palette.colors[(replaced + 3) % 4]!,
                    palette.colors[(replaced + 1) % 4]!,
                ]) {
                    expect(deltaE(neighbour, color)).toBeGreaterThanOrEqual(
                        deltaEThreshold,
                    );
                }
                palette = rotated;
            }
        }
    });

    test('is reproducible with a seeded random', () => {
        const rotate = () => {
            let palette = makePalette(GOLD, { random: seededRandom(7) });
            for (let i = 0; i < 10; i++) {
                palette = palette.rotateRandomOn({ minBrightness: 0.3 });
            }
            return palette.hexes;
        };
        expect(rotate()).toEqual(rotate());
        // the colors a seed draws are part of the 4.0 contract: changing them changes seeded palettes
        let palette = makePalette(GOLD, { random: seededRandom(7) });
        const drawn: string[][] = [];
        for (let i = 0; i < 3; i++) {
            palette = palette.rotateRandomOn();
            drawn.push(hexesOf(palette));
        }
        expect(drawn).toEqual([
            ['#030100', '#f4dca8', '#7a1a2b', '#b8862f'],
            ['#030100', '#6aa9b2', '#7a1a2b', '#b8862f'],
            ['#030100', '#6aa9b2', '#5a7735', '#b8862f'],
        ]);
    });

    test('popOldest().pushRandom() shifts in a random color as before 4.0, drawn from the last color', () => {
        const random = scripted([
            ...hsvDraw(240, 0.9999999, 0.9999999), // blue: too close to the last color
            ...hsvDraw(120, 0.9, 0.5), // close to green, the new first, but far from blue
        ]);
        const palette = makePalette(['red', 'green', 'blue'], { random });
        const shifted = palette.popOldest().pushRandom();
        expect(hexesOf(shifted)).toEqual(['#008000', '#0000ff', '#0d800d']);
        expect(deltaE('#0d800d', 'green')).toBeLessThan(20);
        expect(shifted.ageOrder).toEqual([0, 1, 2]);
    });

    test('passes over a candidate close to the neighbour after it', () => {
        // red is replaced, between blue (before it, around the wheel) and green (after it)
        const random = scripted([
            ...hsvDraw(120, 0.9999999, 0.5), // green: far from blue, too close to green
            ...hsvDraw(60, 0.9999999, 0.9999999), // yellow: far from both
        ]);
        const palette = makePalette(['red', 'green', 'blue'], { random });
        expect(deltaE('#008000', 'blue')).toBeGreaterThan(20);
        const rotated = palette.rotateRandomOn();
        expect(hexesOf(rotated)).toEqual(['#ffff00', '#008000', '#0000ff']);
    });

    test('draws away from the other color of two, and the replaced color of one', () => {
        const draws = [
            ...hsvDraw(0, 0.9999999, 0.9999999), // red
            ...hsvDraw(120, 0.9999999, 0.5), // green
        ];
        // two colors: the other color is both neighbours, so red is passed over
        const two = makePalette(['blue', 'red'], { random: scripted(draws) });
        expect(hexesOf(two.rotateRandomOn())).toEqual(['#008000', '#ff0000']);
        // one color: the color it replaces, so red is passed over
        const one = makePalette(['red'], { random: scripted(draws) });
        expect(hexesOf(one.rotateRandomOn())).toEqual(['#008000']);
    });

    test('an unsatisfiable threshold uses the candidate furthest from its nearer neighbour', () => {
        const random = scripted([
            ...hsvDraw(0, 0.9999999, 0.9999999), // red, beside itself
            ...hsvDraw(60, 0.9999999, 0.9999999), // yellow
            ...hsvDraw(240, 0.9999999, 0.9999999), // blue, beside itself
        ]);
        const palette = makePalette(['red', 'green', 'blue'], {
            deltaEThreshold: 100,
            random,
        });
        // red turns over to red, so green is the oldest, between red and blue
        const rotated = palette.rotateOn('red').rotateRandomOn();
        expect(hexesOf(rotated)).toEqual(['#ff0000', '#ffff00', '#0000ff']);
    });
});

test('types', () => {
    const palette = makePalette();
    expectTypeOf(palette.ageOrder).toEqualTypeOf<readonly number[]>();
    expectTypeOf(palette.rotateOn('red')).toEqualTypeOf<ColorPalette>();
    expectTypeOf(palette.rotateRandomOn()).toEqualTypeOf<ColorPalette>();
    expectTypeOf(palette.popOldest()).toEqualTypeOf<ColorPalette>();
});
