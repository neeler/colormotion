import { bench, describe } from 'vitest';
import {
    adjacentConstraints,
    analyzeTheme,
    hueArc,
    randomColor,
    randomLike,
    relationshipTemplate,
} from '../../src';
import { DUSK, GOLD, seeded } from './fixtures';

/** The brightness (HSV value) of a quarter of full linear light: an LED floor. */
const FLOOR = 0.537;

// Analyzing a theme: five colors, measured at the floor.
describe('analyzeTheme', () => {
    bench('5 colors (gold & oxblood)', () => {
        analyzeTheme(GOLD, { minBrightness: FLOOR });
    });
    bench('2 picks', () => {
        analyzeTheme(['#e8b450', '#7a1a2b'], { minBrightness: FLOOR });
    });
});

describe('templates', () => {
    const analysis = analyzeTheme(DUSK, { minBrightness: FLOOR });
    bench('relationshipTemplate, 5 slots', () => {
        relationshipTemplate(analysis);
    });
    bench('relationshipTemplate, 2 picks grown to 8 slots', () => {
        relationshipTemplate(
            analyzeTheme(['#e8b450', '#7a1a2b'], { minBrightness: FLOOR }),
            { nColors: 8 },
        );
    });
    const random = seeded(1);
    bench("relationshipTemplate('triad'), 5 slots", () => {
        relationshipTemplate('triad', { nColors: 5, random });
    });
});

// One color rolled in its neighbourhood, 20 ΔE from both neighbours: an adjacent single-color roll.
describe('an adjacent roll', () => {
    const constraints = adjacentConstraints(
        analyzeTheme(GOLD, { minBrightness: FLOOR }),
    );
    const random = seeded(2);
    bench('randomColor within adjacentConstraints', () => {
        randomColor({
            random,
            minBrightness: FLOOR,
            constraint: constraints[0],
            awayFrom: [GOLD[4]!, GOLD[1]!],
        });
    });
});

// A whole palette in the same relationship: each call draws until a palette verifies (at most 16).
describe('randomLike, 5 slots', () => {
    const dusk = analyzeTheme(DUSK, { minBrightness: FLOOR });
    const wild = relationshipTemplate(dusk, { hueWidth: 8 });
    const random = seeded(3);
    bench('any anchor', () => {
        randomLike(wild, { random, minBrightness: FLOOR });
    });
    bench('30–90° away, avoiding olive and lime (a wild roll)', () => {
        const anchor = dusk.anchor!;
        randomLike(wild, {
            random,
            minBrightness: FLOOR,
            anchor: [
                hueArc(anchor + 30, anchor + 90),
                hueArc(anchor - 90, anchor - 30),
            ],
            avoid: [hueArc(95, 135)],
        });
    });
    bench('from the analysis, 8 colors', () => {
        randomLike(dusk, { random, minBrightness: FLOOR, nColors: 8 });
    });
});

/*
 * The costliest case known: olive and green (an accent 30.5° apart, whose adjacent slots are about ±0.25°
 * wide) grown to 8 colors and placed as a wild roll at the brightness of 60 % linear light. Most colors
 * cannot reach 20 ΔE from the one before them, so without a budget each pays all 100 candidates, in every
 * attempt.
 */
describe('randomLike, the costliest known case (olive and green at floor 0.6, 8 colors, a wild roll)', () => {
    const floor = 1.055 * 0.6 ** (1 / 2.4) - 0.055;
    const analysis = analyzeTheme(['#808a0c', '#48b254'], {
        minBrightness: floor,
    });
    const wild = relationshipTemplate(analysis, { nColors: 8, hueWidth: 8 });
    const anchor = analysis.anchor!;
    const options = {
        minBrightness: floor,
        anchor: [
            hueArc(anchor + 30, anchor + 90),
            hueArc(anchor - 90, anchor - 30),
        ],
        avoid: [hueArc(95, 135)],
    };
    // enough rolls for the tail: a roll that needs many attempts is the costly one
    const runs = { time: 0, iterations: 300, warmupIterations: 20 };
    const plain = seeded(4);
    bench(
        'without a budget',
        () => {
            randomLike(wild, { ...options, random: plain });
        },
        runs,
    );
    const budgeted = seeded(4);
    bench(
        'candidateBudget 1000',
        () => {
            randomLike(wild, {
                ...options,
                random: budgeted,
                candidateBudget: 1000,
            });
        },
        runs,
    );
});
