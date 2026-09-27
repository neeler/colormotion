import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    ColorConstraint,
    ColorPalette,
    HueRange,
    hueArc,
    measureColor,
    meetsConstraint,
    randomColor,
} from '../src';

/*
 * Statistics of random draws, over seeded samples, so every run sees the same numbers. The bounds leave room
 * around the values measured (given in each test), several standard errors wide.
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
const N = 20_000;
const OLIVE_AND_LIME = hueArc(95, 135);

/** Five-color themes, as an LED piece would use them. */
const THEMES: Record<string, string[]> = {
    crimson: ['#c8102e', '#ff5a5a', '#5a0a14', '#ff2d6b', '#2a0508'],
    dusk: ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'],
    emerald: ['#2b8f6b', '#9fe0c0', '#0f4f4a', '#3fb28a', '#123024'],
    gold: ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'],
    sodium: ['#ff9a1f', '#ffd27a', '#b8450e', '#ff7a2a', '#3a1d05'],
};

/** Measures of n colors drawn with the constraint (none: HSV), from a seeded random. */
function draws(constraint: ColorConstraint | undefined, seed = 42, n = N) {
    const random = seededRandom(seed);
    return Array.from({ length: n }, () =>
        measureColor(randomColor({ random, minBrightness: FLOOR, constraint })),
    );
}

/** The share of colors in each 30° of OKLCH hue, from 0°, among those at least `chroma` saturated. */
function hueShares(measures: ReturnType<typeof draws>, chroma = 0.12) {
    const bins = new Array<number>(12).fill(0);
    let n = 0;
    for (const { hue, chroma: c } of measures) {
        if (hue === null || c < chroma) continue;
        bins[Math.floor(hue / 30)]!++;
        n++;
    }
    return bins.map((count) => count / n);
}

const share = <T>(items: T[], predicate: (item: T) => boolean) =>
    items.filter(predicate).length / items.length;

describe('OKLCH draws', () => {
    test('are uniform in hue: each 30° holds 8.3 % ± 1 %', () => {
        // measured: 8.1–8.9 %
        for (const binShare of hueShares(draws({}))) {
            expect(binShare).toBeGreaterThan(1 / 12 - 0.01);
            expect(binShare).toBeLessThan(1 / 12 + 0.01);
        }
    }, 20_000);

    test('where HSV draws favor greens and blues, and pass over gold and cyan', () => {
        // uniform HSV hue at full saturation (measured: 22.0 % from 120° to 150°, 14.8 % from 240° to 270°,
        // 4.1 % from 60° to 90°, 3.8 % in each 30° from 180° to 240°)
        const random = seededRandom(7);
        const bins = new Array<number>(12).fill(0);
        for (let i = 0; i < N; i++) {
            const [, , hue] = chroma.hsv(random() * 360, 1, 1).oklch();
            bins[Math.floor(hue / 30)]!++;
        }
        const shares = bins.map((count) => count / N);
        expect(shares[4]).toBeGreaterThan(0.2);
        expect(shares[8]).toBeGreaterThan(0.13);
        for (const bin of [2, 6, 7]) {
            expect(shares[bin]).toBeLessThan(0.05);
        }
    }, 20_000);

    test('within a chroma floor of 0.5, draw no greys or pastels, where HSV draws a quarter', () => {
        const floored = draws({ chroma: { min: 0.5 } });
        expect(share(floored, (m) => m.chroma < 0.5 - 1e-9)).toBe(0);
        // HSV at the same brightness floor: 26.8 % under relative chroma 0.35, 9.3 % under 0.12
        const hsv = draws(undefined);
        expect(share(hsv, (m) => m.chroma < 0.35)).toBeGreaterThan(0.25);
        expect(share(hsv, (m) => m.chroma < 0.35)).toBeLessThan(0.29);
        // unconstrained OKLCH draws are uniform in chroma: 35.0 % under 0.35
        expect(share(draws({}), (m) => m.chroma < 0.35)).toBeCloseTo(0.35, 1);
    }, 20_000);

    test('avoiding olive and lime draw no hue from 95° to 135°', () => {
        const measures = draws({ avoid: [OLIVE_AND_LIME] });
        expect(
            share(
                measures,
                (m) =>
                    m.hue !== null && m.hue > 95 + 1e-9 && m.hue < 135 - 1e-9,
            ),
        ).toBe(0);
        // HSV at the floor: 12.4 % of draws there, of relative chroma 0.12 or more
        expect(
            share(
                draws(undefined),
                (m) =>
                    m.hue !== null &&
                    m.chroma >= 0.12 &&
                    m.hue >= 95 &&
                    m.hue < 135,
            ),
        ).toBeGreaterThan(0.1);
    }, 20_000);

    test('every draw meets its constraint, at its brightness floor', () => {
        const random = seededRandom(9);
        const arc = (): HueRange => ({
            center: random() * 360,
            width: random() < 0.1 ? 0 : random() * 120,
        });
        let checked = 0;
        for (let i = 0; i < 5000; i++) {
            const constraint: ColorConstraint = {
                hues: Array.from({ length: Math.floor(random() * 4) }, arc),
                avoid: Array.from({ length: Math.floor(random() * 3) }, arc),
                chroma: { min: random(), max: random() },
            };
            const minBrightness = random();
            const color = randomColor({ random, minBrightness, constraint });
            expect(meetsConstraint(color, constraint)).toBe(true);
            expect(measureColor(color).brightness).toBeGreaterThanOrEqual(
                minBrightness - 1e-12,
            );
            checked++;
        }
        expect(checked).toBe(5000);
    }, 20_000);
});

/**
 * Neighbourhoods around each color of a theme, as its adjacent rolls would use them: its hue ± 12°, plus a
 * quarter of the span of the hues it sits among (colors within 30° of one another), up to ± 20°, and its
 * relative chroma ± 0.2, kept saturated (0.75 or more), muted (0.15 to 0.72) or near grey (under 0.08, any
 * hue) as it is.
 */
function neighbourhoods(colors: string[]): ColorConstraint[] {
    const measures = colors.map((color) =>
        measureColor(color, { minBrightness: FLOOR }),
    );
    const chromatic = measures
        .map((measure, i) => ({ hue: measure.hue, i }))
        .filter(
            (pick): pick is { hue: number; i: number } =>
                pick.hue !== null && measures[pick.i]!.chroma >= 0.12,
        )
        .sort((a, b) => a.hue - b.hue);
    // spans of the runs of hues less than 30° apart, starting after the widest gap
    const spanOf = new Map<number, number>();
    const gaps = chromatic.map(
        (pick, k) =>
            (chromatic[(k + 1) % chromatic.length]!.hue - pick.hue + 360) %
                360 || 360,
    );
    const first = (gaps.indexOf(Math.max(...gaps)) + 1) % chromatic.length;
    let run: number[] = [];
    const endRun = () => {
        const hues = run.map((i) => measures[i]!.hue!);
        const span = (hues[hues.length - 1]! - hues[0]! + 360) % 360;
        run.forEach((i) => spanOf.set(i, span));
        run = [];
    };
    for (let j = 0; j < chromatic.length; j++) {
        const k = (first + j) % chromatic.length;
        const gapBefore = gaps[(k + chromatic.length - 1) % chromatic.length]!;
        if (j > 0 && gapBefore >= 30) endRun();
        run.push(chromatic[k]!.i);
    }
    endRun();

    return measures.map(({ hue, chroma: c }, i) => {
        if (!spanOf.has(i)) {
            return { chroma: { max: 0.08 } };
        }
        const [low, high] = c >= 0.75 ? [0.75, 1] : [0.15, 0.72];
        return {
            hues: [
                {
                    center: hue!,
                    width: 2 * Math.min(20, 12 + spanOf.get(i)! / 4),
                },
            ],
            chroma: {
                min: Math.max(low, c - 0.2),
                max: Math.min(high, c + 0.2),
            },
        };
    });
}

test('adjacent rolls keep deltaEThreshold from both neighbours in about 99 % of rolls, and come close otherwise', () => {
    // rotateRandomOn with each theme's neighbourhoods as its constraints, at the floor, ΔE 20. Measured over
    // 50,000 rolls (10 seeds): 0.78 % fall back to the furthest of 100 candidates (crimson 1.02 %, dusk 1.02 %,
    // emerald 1.48 %, gold 0.03 %, sodium 0.37 %), the nearest at ΔE 15.6. In a tight hue family, the distance
    // has to come from brightness and chroma, and few candidates reach it.
    let rolls = 0;
    let fallbacks = 0;
    let nearest = Infinity;
    for (const colors of Object.values(THEMES)) {
        const constraints = neighbourhoods(colors);
        for (const seed of [1, 2]) {
            let palette = new ColorPalette({
                colors,
                mode: 'oklch',
                nSteps: 16,
                random: seededRandom(seed),
            });
            for (let roll = 0; roll < 1000; roll++) {
                const replaced = palette.ageOrder[0]!;
                const n = palette.nColors;
                const neighbours = [
                    palette.colors[(replaced + n - 1) % n]!,
                    palette.colors[(replaced + 1) % n]!,
                ];
                palette = palette.rotateRandomOn({
                    minBrightness: FLOOR,
                    constraints,
                });
                const color = palette.colors[replaced]!;
                expect(meetsConstraint(color, constraints[replaced]!)).toBe(
                    true,
                );
                const distance = Math.min(
                    ...neighbours.map((neighbour) =>
                        chroma.deltaE(neighbour, color, 1, 1, 1),
                    ),
                );
                rolls++;
                if (distance < 20) {
                    fallbacks++;
                    nearest = Math.min(nearest, distance);
                }
            }
        }
    }
    expect(fallbacks / rolls).toBeLessThan(0.015);
    if (fallbacks > 0) {
        expect(nearest).toBeGreaterThan(15);
    }
}, 30_000);
