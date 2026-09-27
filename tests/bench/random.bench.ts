import { bench, describe } from 'vitest';
import {
    ColorPalette,
    colorFromHue,
    hueArc,
    measureColor,
    randomColor,
} from '../../src';
import { GOLD, seeded } from './fixtures';

/** The brightness (HSV value) of a quarter of full linear light: an LED floor. */
const FLOOR = 0.537;

/** A neighbourhood around gold, as a theme's adjacent rolls would draw in. */
const NEAR_GOLD = { hues: [hueArc(66, 96)], chroma: { min: 0.62, max: 1 } };

// One random color: in HSV (no constraint, as in 4.0), and in OKLCH within constraints.
describe('randomColor', () => {
    const random = seeded(1);
    bench('HSV (no constraint)', () => {
        randomColor({ random, minBrightness: FLOOR });
    });
    bench('OKLCH, any hue and chroma ({})', () => {
        randomColor({ random, minBrightness: FLOOR, constraint: {} });
    });
    bench('OKLCH, a hue arc and a chroma floor', () => {
        randomColor({ random, minBrightness: FLOOR, constraint: NEAR_GOLD });
    });
    bench('OKLCH, avoiding olive and lime', () => {
        randomColor({
            random,
            minBrightness: FLOOR,
            constraint: { avoid: [hueArc(95, 135)], chroma: { min: 0.5 } },
        });
    });
    // candidates are drawn until one is 20 ΔE from both neighbours: gold rolled between oxblood and umber
    bench('OKLCH, near gold, 20 ΔE from two neighbours', () => {
        randomColor({
            random,
            minBrightness: FLOOR,
            constraint: NEAR_GOLD,
            awayFrom: ['#7a1a2b', '#2b1a12'],
        });
    });
    bench('OKLCH, 100 candidates (an unmet distance)', () => {
        randomColor({
            random,
            minBrightness: FLOOR,
            constraint: NEAR_GOLD,
            awayFrom: ['#e8b450'],
            deltaEThreshold: 200,
        });
    });
});

describe('measures', () => {
    const random = seeded(2);
    bench('measureColor', () => {
        measureColor(
            colorFromHue({
                hue: random() * 360,
                brightness: random(),
                chroma: random(),
            }),
        );
    });
    bench('colorFromHue', () => {
        colorFromHue({
            hue: random() * 360,
            brightness: random(),
            chroma: random(),
        });
    });
    bench('colorFromHue, in the blue fold (264.05°–264.21°)', () => {
        colorFromHue({
            hue: 264.05 + 0.16 * random(),
            brightness: random(),
            chroma: random(),
        });
    });
});

// A rotation with a constraint per position, as a palette of picks rolls one color at a time.
describe('ColorPalette.rotateRandomOn, oklch, 256 steps', () => {
    const constraints = GOLD.map((color) => {
        const { hue, chroma } = measureColor(color, { minBrightness: FLOOR });
        return {
            hues: [{ center: hue!, width: 24 }],
            chroma: { min: Math.max(0.15, chroma - 0.2) },
        };
    });
    const plain = new ColorPalette({
        colors: GOLD,
        mode: 'oklch',
        nSteps: 256,
        random: seeded(3),
    });
    const constrained = new ColorPalette({
        colors: GOLD,
        mode: 'oklch',
        nSteps: 256,
        random: seeded(3),
    });
    bench('HSV (no constraints)', () => {
        plain.rotateRandomOn({ minBrightness: FLOOR });
    });
    bench('within the constraint for the position', () => {
        constrained.rotateRandomOn({ minBrightness: FLOOR, constraints });
    });
});
