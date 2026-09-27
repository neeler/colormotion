import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    ColorConstraint,
    ColorPalette,
    Theme,
    hueArc,
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

/** One constraint per position: 16° of hue, 45° apart, saturated. */
const POSITIONS: ColorConstraint[] = Array.from({ length: 8 }, (_, i) => ({
    hues: [{ center: 20 + 45 * i, width: 16 }],
    chroma: { min: 0.6 },
}));

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const N_STEPS = 16;

function makeTheme(seed: number, colors = GOLD) {
    return new Theme({
        colors,
        mode: 'oklch',
        nSteps: N_STEPS,
        random: seededRandom(seed),
    });
}

function makePalette(seed: number, colors = GOLD) {
    return new ColorPalette({
        colors,
        mode: 'oklch',
        nSteps: N_STEPS,
        random: seededRandom(seed),
    });
}

/** A palette's colors, without the closing repeat of the first, at full precision. */
const channelsOf = (palette: Readonly<ColorPalette>) =>
    palette.colors.slice(0, palette.nColors).map((color) => color.rgb(false));

/** The position of the one constraint of POSITIONS a color meets, or -1. */
function positionOf(color: chroma.Color) {
    const met = POSITIONS.map((constraint, i) =>
        meetsConstraint(color, constraint) ? i : -1,
    ).filter((i) => i >= 0);
    return met.length === 1 ? met[0]! : -1;
}

const positionsOf = (palette: Readonly<ColorPalette>) =>
    palette.colors.slice(0, palette.nColors).map(positionOf);

describe('Theme passes constraints to its palette', () => {
    test('the constructor and Theme.random', () => {
        const theme = new Theme({
            nColors: 5,
            minBrightness: 0.3,
            constraints: POSITIONS,
            mode: 'oklch',
            nSteps: N_STEPS,
            random: seededRandom(1),
        });
        expect(positionsOf(theme.palette)).toEqual([0, 1, 2, 3, 4]);
        expect(channelsOf(theme.palette)).toEqual(
            channelsOf(
                ColorPalette.random({
                    nColors: 5,
                    minBrightness: 0.3,
                    constraints: POSITIONS,
                    mode: 'oklch',
                    nSteps: N_STEPS,
                    random: seededRandom(1),
                }),
            ),
        );

        const one = { hues: [hueArc(200, 240)], chroma: { min: 0.5 } };
        const random = Theme.random({
            nColors: 3,
            constraints: one,
            nSteps: N_STEPS,
            random: seededRandom(2),
        });
        for (const color of random.palette.colors) {
            expect(meetsConstraint(color, one)).toBe(true);
        }
    });

    test('randomFrom and randomTheme, with their transition options', () => {
        const theme = makeTheme(3);
        theme.randomFrom('#808080', {
            nColors: 4,
            constraints: POSITIONS,
            transitionDuration: 0,
        });
        expect(theme.isTransitioning).toBe(false);
        expect(theme.palette.hexes[0]).toBe('#808080');
        expect(positionsOf(theme.palette).slice(1)).toEqual([1, 2, 3]);
        expect(channelsOf(theme.palette)).toEqual(
            channelsOf(
                makePalette(3).randomizeFrom('#808080', {
                    nColors: 4,
                    constraints: POSITIONS,
                }),
            ),
        );

        theme.randomTheme({
            minBrightness: 0.5,
            constraints: POSITIONS,
            transitionDuration: 30,
        });
        expect(theme.isTransitioning).toBe(true);
        expect(positionsOf(theme.activePalette)).toEqual([0, 1, 2, 3]);
        for (let i = 0; i < 30; i++) {
            theme.tick(0);
        }
        expect(theme.isTransitioning).toBe(false);
        expect(positionsOf(theme.palette)).toEqual([0, 1, 2, 3]);
    });

    test('pushRandomColor and rotateRandomColor', () => {
        const theme = makeTheme(4, GOLD.slice(0, 2));
        theme.pushRandomColor({ constraints: POSITIONS });
        theme.pushRandomColor({
            constraints: POSITIONS,
            transitionDuration: 0,
        });
        expect(positionsOf(theme.activePalette).slice(2)).toEqual([2, 3]);

        for (let rotation = 0; rotation < 4; rotation++) {
            const oldest = theme.activePalette.ageOrder[0]!;
            theme.rotateRandomColor({
                minBrightness: 0.537,
                constraints: POSITIONS,
                transitionSpeed: 0.5,
            });
            expect(positionOf(theme.activePalette.colors[oldest]!)).toBe(
                oldest,
            );
        }
        expect(positionsOf(theme.activePalette)).toEqual([0, 1, 2, 3]);

        // the same colors as the palette methods draw
        const palette = makePalette(5)
            .pushRandom({ constraints: POSITIONS })
            .rotateRandomOn({ constraints: POSITIONS });
        const other = makeTheme(5);
        other.pushRandomColor({ constraints: POSITIONS });
        other.rotateRandomColor({ constraints: POSITIONS });
        expect(channelsOf(other.activePalette)).toEqual(channelsOf(palette));
    });
});
