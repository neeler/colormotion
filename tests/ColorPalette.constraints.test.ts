import chroma from 'chroma-js';
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
    ColorConstraint,
    ColorConstraints,
    ColorPalette,
    RandomColorConfig,
    RandomPaletteConfig,
    hueArc,
    measureColor,
    meetsConstraint,
} from '../src';

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

/** One constraint per position: 16° of hue, 45° apart, saturated. */
const POSITIONS: ColorConstraint[] = Array.from({ length: 8 }, (_, i) => ({
    hues: [{ center: 20 + 45 * i, width: 16 }],
    chroma: { min: 0.6 },
}));

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];

function makePalette(seed: number, colors = GOLD) {
    return new ColorPalette({
        colors,
        mode: 'oklch',
        nSteps: 16,
        random: seededRandom(seed),
    });
}

/** The palette's colors, without the closing repeat of the first. */
const colorsOf = (palette: ColorPalette) =>
    palette.colors.slice(0, palette.nColors);

/** The position of the one constraint of POSITIONS a color meets, or -1. */
function positionOf(color: chroma.Color) {
    const met = POSITIONS.map((constraint, i) =>
        meetsConstraint(color, constraint) ? i : -1,
    ).filter((i) => i >= 0);
    return met.length === 1 ? met[0]! : -1;
}

describe('ColorPalette.random', () => {
    test('the color at position i meets constraints[i]', () => {
        for (const seed of [1, 2, 3]) {
            const palette = ColorPalette.random({
                nColors: 6,
                minBrightness: 0.4,
                mode: 'oklch',
                nSteps: 16,
                random: seededRandom(seed),
                constraints: POSITIONS,
            });
            expect(colorsOf(palette).map(positionOf)).toEqual([
                0, 1, 2, 3, 4, 5,
            ]);
            for (const color of colorsOf(palette)) {
                expect(measureColor(color).brightness).toBeGreaterThanOrEqual(
                    0.4,
                );
            }
        }
    });

    test('one constraint applies to every color', () => {
        const constraint = { hues: [hueArc(60, 100)], chroma: { min: 0.7 } };
        const palette = ColorPalette.random({
            nColors: 8,
            mode: 'rgb',
            nSteps: 16,
            random: seededRandom(4),
            constraints: constraint,
        });
        for (const color of colorsOf(palette)) {
            expect(meetsConstraint(color, constraint)).toBe(true);
        }
    });

    test('a missing entry is no limit, still drawn in OKLCH; left out, colors are drawn in HSV', () => {
        const draws = [1, 0.5, 1]; // brightness 1, halfway round, most chroma (or saturation)
        const oklch = ColorPalette.random({
            nColors: 1,
            mode: 'rgb',
            nSteps: 16,
            random: scripted(draws),
            constraints: [undefined],
        });
        expect(measureColor(oklch.colors[0]!).hue).toBeCloseTo(180, 6);
        const hsv = ColorPalette.random({
            nColors: 1,
            mode: 'rgb',
            nSteps: 16,
            random: scripted(draws),
        });
        expect(hsv.hexes[0]).toBe('#00ffff');
        // past the end of the list
        const past = ColorPalette.random({
            nColors: 2,
            mode: 'rgb',
            nSteps: 16,
            random: scripted([...draws, 1, 0.1, 1]),
            constraints: [{}],
        });
        expect(measureColor(past.colors[1]!).hue).toBeCloseTo(36, 6);
    });

    test('keeps each color deltaEThreshold from the one before it', () => {
        const palette = ColorPalette.random({
            nColors: 8,
            minBrightness: 0.5,
            mode: 'rgb',
            nSteps: 16,
            deltaEThreshold: 25,
            random: seededRandom(5),
            constraints: { chroma: { min: 0.5 } },
        });
        const colors = colorsOf(palette);
        for (let i = 1; i < colors.length; i++) {
            expect(
                chroma.deltaE(colors[i - 1]!, colors[i]!, 1, 1, 1),
            ).toBeGreaterThanOrEqual(25);
        }
    });
});

describe('randomizeFrom, randomize and pushRandom', () => {
    test('randomizeFrom keeps the seed at position 0 as it is; the colors after it meet their constraints', () => {
        const palette = makePalette(6).randomizeFrom('#808080', {
            nColors: 5,
            constraints: POSITIONS,
        });
        expect(palette.hexes[0]).toBe('#808080');
        expect(colorsOf(palette).slice(1).map(positionOf)).toEqual([
            1, 2, 3, 4,
        ]);
    });

    test('randomize draws position 0 within constraints[0] too', () => {
        const palette = makePalette(7).randomize({
            nColors: 6,
            minBrightness: 0.3,
            constraints: POSITIONS,
        });
        expect(colorsOf(palette).map(positionOf)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    test('pushRandom draws within the constraint for the position it takes, constraints[nColors]', () => {
        let palette = makePalette(8, GOLD.slice(0, 2));
        for (let i = 0; i < 4; i++) {
            palette = palette.pushRandom({ constraints: POSITIONS });
        }
        expect(colorsOf(palette).slice(2).map(positionOf)).toEqual([
            2, 3, 4, 5,
        ]);
    });
});

describe('rotateRandomOn', () => {
    test('draws within the constraint for the position it replaces, constraints[ageOrder[0]]', () => {
        let palette = makePalette(9);
        for (let rotation = 0; rotation < 12; rotation++) {
            const oldest = palette.ageOrder[0]!;
            palette = palette.rotateRandomOn({
                minBrightness: 0.537,
                constraints: POSITIONS,
            });
            expect(positionOf(palette.colors[oldest]!)).toBe(oldest);
        }
        // every position has turned over, each within its own constraint
        expect(colorsOf(palette).map(positionOf)).toEqual([0, 1, 2, 3, 4]);
    });

    test('follows the ages, not the list order', () => {
        // red turns over first, so green is the oldest
        const palette = makePalette(10, ['red', 'green', 'blue']).rotateOn(
            'red',
        );
        expect(palette.ageOrder[0]).toBe(1);
        const rotated = palette.rotateRandomOn({ constraints: POSITIONS });
        expect(positionOf(rotated.colors[1]!)).toBe(1);
        expect(rotated.hexes[0]).toBe('#ff0000');
        expect(rotated.hexes[2]).toBe('#0000ff');
    });

    test("keeps deltaEThreshold from both of the replaced color's neighbours", () => {
        let palette = new ColorPalette({
            colors: GOLD,
            mode: 'oklch',
            nSteps: 16,
            random: seededRandom(11),
        });
        const constraint = { chroma: { min: 0.5 } };
        for (let rotation = 0; rotation < 30; rotation++) {
            const replaced = palette.ageOrder[0]!;
            const rotated = palette.rotateRandomOn({
                constraints: constraint,
            });
            const color = rotated.colors[replaced]!;
            expect(meetsConstraint(color, constraint)).toBe(true);
            for (const neighbour of [
                palette.colors[(replaced + 4) % 5]!,
                palette.colors[(replaced + 1) % 5]!,
            ]) {
                expect(
                    chroma.deltaE(neighbour, color, 1, 1, 1),
                ).toBeGreaterThanOrEqual(20);
            }
            palette = rotated;
        }
    });

    test('is reproducible with a seeded random', () => {
        const rotate = () => {
            let palette = makePalette(12);
            for (let i = 0; i < 10; i++) {
                palette = palette.rotateRandomOn({
                    minBrightness: 0.3,
                    constraints: POSITIONS,
                });
            }
            return palette.colors.map((color) => color.rgb(false));
        };
        expect(rotate()).toEqual(rotate());
    });
});

test('types', () => {
    expectTypeOf<RandomPaletteConfig['constraints']>().toEqualTypeOf<
        ColorConstraints | undefined
    >();
    expectTypeOf<RandomColorConfig>().toEqualTypeOf<{
        minBrightness?: number;
        constraints?: ColorConstraints;
    }>();
});
