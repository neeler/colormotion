import { describe, expect, test } from 'vitest';
import {
    Relationship,
    analyzeTheme,
    hueArc,
    measureColor,
    meetsConstraint,
    randomColor,
    randomLike,
    relationshipTemplate,
    templateConstraints,
} from '../src';

/*
 * Statistics of relationship templates and randomLike, over seeded samples, so every run sees the same
 * numbers. The bounds leave room around the values measured (given in each test).
 */

/**
 * Small seeded PRNG (mulberry32) for reproducible draws in tests.
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

/** The brightness (HSV value) of a quarter of full linear light: an LED floor. */
const FLOOR = 0.537;
const OLIVE_AND_LIME = hueArc(95, 135);

/** Five-color themes, as an LED piece would use them. */
const THEMES: Record<string, string[]> = {
    crimson: ['#c8102e', '#ff5a5a', '#5a0a14', '#ff2d6b', '#2a0508'],
    dusk: ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'],
    emerald: ['#2b8f6b', '#9fe0c0', '#0f4f4a', '#3fb28a', '#123024'],
    gold: ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'],
    sodium: ['#ff9a1f', '#ffd27a', '#b8450e', '#ff7a2a', '#3a1d05'],
};

/** A few picks, as a DJ might choose them. */
const PICKS: Record<string, string[]> = {
    'red and blue': ['#ff0000', '#0000ff'],
    'pink and purple': ['#ff4fa0', '#8a2be2'],
    'gold and oxblood': ['#e8b450', '#7a1a2b'],
    'red, green and blue': ['#ff0000', '#00ff00', '#0000ff'],
    'red, yellow and blue': ['#ff0000', '#ffff00', '#0000ff'],
    'violet, magenta and orange': ['#6b2fa0', '#c0409a', '#ff7a1a'],
    'red and white': ['#ff0000', '#ffffff'],
};

describe('randomLike', () => {
    test('keeps the relationship of every theme and set of picks: 100 % verified, 95 % or more at the first attempt', () => {
        // measured, 1000 draws each: 100 % at the first attempt, for every theme and set of picks
        for (const colors of [
            ...Object.values(THEMES),
            ...Object.values(PICKS),
        ]) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const random = seededRandom(1);
            let first = 0;
            let verified = 0;
            const N = 500;
            for (let i = 0; i < N; i++) {
                if (randomLike(analysis, { random, attempts: 1 }).verified) {
                    first++;
                }
                if (randomLike(analysis, { random }).verified) verified++;
            }
            expect(verified).toBe(N);
            expect(first / N).toBeGreaterThanOrEqual(0.95);
        }
    }, 30_000);

    test('keeps it placed as a wild roll would be: 30–90° from the anchor, with no slot centered in olive or lime', () => {
        const random = seededRandom(2);
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const wild = relationshipTemplate(analysis, { hueWidth: 8 });
            const anchor = analysis.anchor!;
            for (let i = 0; i < 300; i++) {
                const result = randomLike(wild, {
                    random,
                    minBrightness: FLOOR,
                    anchor: [
                        hueArc(anchor + 30, anchor + 90),
                        hueArc(anchor - 90, anchor - 30),
                    ],
                    avoid: [OLIVE_AND_LIME],
                });
                expect(result.verified).toBe(true);
                const travel = Math.abs(
                    ((result.anchor - anchor + 540) % 360) - 180,
                );
                expect(travel).toBeGreaterThanOrEqual(30 - 1e-9);
                expect(travel).toBeLessThanOrEqual(90 + 1e-9);
                result.constraints.forEach((constraint, s) => {
                    const center = constraint.hues![0]!.center;
                    expect(center > 95 && center < 135).toBe(false);
                    const { hue } = measureColor(result.colors[s]!);
                    expect(hue! > 95 + 1e-6 && hue! < 135 - 1e-6).toBe(false);
                });
            }
        }
    }, 30_000);

    test('draws an anchor left free uniformly around the wheel', () => {
        // chi-square over 12 bins of 30°, 6000 draws: under 31.3 (p = 0.001, 11 degrees of freedom)
        const analysis = analyzeTheme(THEMES.gold!, { minBrightness: FLOOR });
        const template = relationshipTemplate(analysis, { hueWidth: 8 });
        const random = seededRandom(3);
        const N = 6000;
        const bins = new Array<number>(12).fill(0);
        for (let i = 0; i < N; i++) {
            const { anchor } = randomLike(template, {
                random,
                deltaEThreshold: 0,
                attempts: 1,
            });
            bins[Math.floor(anchor / 30)]!++;
        }
        const expected = N / 12;
        const chiSquare = bins.reduce(
            (sum, count) => sum + (count - expected) ** 2 / expected,
            0,
        );
        expect(chiSquare).toBeLessThan(31.3);
    }, 30_000);

    test('returns the constraints its colors were drawn in', () => {
        const random = seededRandom(4);
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            for (let i = 0; i < 100; i++) {
                const avoid = random() < 0.5 ? [OLIVE_AND_LIME] : [];
                const result = randomLike(analysis, {
                    random,
                    avoid,
                    nColors: 5 + Math.floor(random() * 4),
                });
                const template = relationshipTemplate(analysis, {
                    hueWidth: 8,
                    nColors: result.colors.length,
                });
                expect(result.constraints).toEqual(
                    templateConstraints(template, result.anchor, {
                        mirrored: result.mirrored,
                        avoid,
                    }),
                );
                result.colors.forEach((color, s) => {
                    expect(
                        meetsConstraint(color, result.constraints[s]!, {
                            minBrightness: FLOOR,
                        }),
                    ).toBe(true);
                });
            }
        }
    }, 30_000);
});

describe('single colors rolled within the slots', () => {
    test('keep the relationship of the concept themes: 100 % of rolls, colors rounded to 8 bits', () => {
        // a whole palette drawn by randomLike (at the theme's anchor, or placed elsewhere as a wild roll
        // would be), then 20 single colors rolled in turn, each within its slot and 20 ΔE from both
        // neighbours, as hex. Measured: 100 % of 20,000 rolls per level.
        const random = seededRandom(5);
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const anchor = analysis.anchor!;
            for (const hueWidth of [8, 12]) {
                const template = relationshipTemplate(analysis, { hueWidth });
                for (let whole = 0; whole < 40; whole++) {
                    const result =
                        hueWidth === 8
                            ? randomLike(template, {
                                  random,
                                  minBrightness: FLOOR,
                                  anchor: [
                                      hueArc(anchor + 30, anchor + 90),
                                      hueArc(anchor - 90, anchor - 30),
                                  ],
                                  avoid: [OLIVE_AND_LIME],
                              })
                            : randomLike(template, {
                                  random,
                                  minBrightness: FLOOR,
                                  anchor,
                                  mirror: false,
                              });
                    const stops = result.colors.map((color) => color.hex());
                    const n = stops.length;
                    for (let roll = 0; roll < 20; roll++) {
                        const i = roll % n;
                        stops[i] = randomColor({
                            random,
                            minBrightness: FLOOR,
                            constraint: result.constraints[i],
                            awayFrom: [
                                stops[(i + n - 1) % n]!,
                                stops[(i + 1) % n]!,
                            ],
                        }).hex();
                        const after = analyzeTheme(stops, {
                            minBrightness: FLOOR,
                        });
                        expect(after.relationship).toBe(analysis.relationship);
                        expect(after.groups).toHaveLength(
                            analysis.groups.length,
                        );
                    }
                }
            }
        }
    }, 30_000);
});

describe('templates from a kind', () => {
    const kinds: Exclude<Relationship, 'neutral'>[] = [
        'family',
        'accent',
        'contrast',
        'bridge',
        'pair-accent',
        'triad',
        'spectrum',
    ];
    /** The groups a kind needs: with fewer slots, it is laid out as another kind. */
    const needs: Record<Exclude<Relationship, 'neutral'>, number> = {
        family: 1,
        accent: 2,
        contrast: 2,
        bridge: 3,
        'pair-accent': 3,
        triad: 3,
        spectrum: 4,
    };

    test('classify as their kind: 1000 seeds × 7 kinds × 2–8 colors, all verified', () => {
        // measured at the first attempt: 98.0 % (pair-accent, bridge) to 99.5 % (family); spectrum 91.1 %,
        // every miss a near-black color (possible at a minBrightness of 0) that counts as neutral
        let first = 0;
        let total = 0;
        for (const kind of kinds) {
            for (let nColors = 2; nColors <= 8; nColors++) {
                for (let seed = 0; seed < 1000; seed++) {
                    const random = seededRandom(seed * 31 + nColors);
                    const template = relationshipTemplate(kind, {
                        nColors,
                        random,
                    });
                    if (nColors >= needs[kind]) {
                        expect(template.relationship).toBe(kind);
                    }
                    if (randomLike(template, { random, attempts: 1 }).verified)
                        first++;
                    const result = randomLike(template, { random });
                    expect(result.verified).toBe(true);
                    expect(result.relationship).toBe(template.relationship);
                    total++;
                }
            }
        }
        expect(first / total).toBeGreaterThan(0.95);
    }, 60_000);
});
