import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { colorFromHue, maxChroma, measureColor } from '../src';

/**
 * Small seeded PRNG (mulberry32) for reproducible samples in tests.
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

/** The signed difference between two hues, in degrees, from −180 to 180. */
function hueDifference(a: number, b: number) {
    const d = (((a - b) % 360) + 540) % 360;
    return d - 180;
}

/** chroma-js's OKLCH chroma and hue. */
function oklch(color: chroma.Color) {
    const [, C, h] = color.oklch();
    return { C, h };
}

/** The HSV value of a color, 0–1. */
const valueOf = (color: chroma.Color) => Math.max(...color.rgb(false)) / 255;

/** The edge color hsv(θ, 1, V), at full precision. */
const edge = (theta: number, value: number) => chroma.hsv(theta, 1, value);

const BLUE_HUE = oklch(chroma('#0000ff')).h;

describe('measureColor', () => {
    test('primaries and secondaries, #0000ff included, measure relative chroma 1 at every brightness', () => {
        for (const hex of [
            '#ff0000',
            '#ffff00',
            '#00ff00',
            '#00ffff',
            '#0000ff',
            '#ff00ff',
        ]) {
            for (const value of [1, 0.537, 0.1, 0.01]) {
                const color = chroma(hex).set('hsv.v', value);
                const measure = measureColor(color);
                expect(measure.chroma).toBeCloseTo(1, 12);
                expect(measure.brightness).toBeCloseTo(value, 15);
                expect(hueDifference(measure.hue!, oklch(color).h)).toBeCloseTo(
                    0,
                    9,
                );
            }
        }
    });

    test('greys, white and black have no hue and chroma 0', () => {
        expect(measureColor('#000000')).toEqual({
            hue: null,
            chroma: 0,
            brightness: 0,
        });
        expect(measureColor('#808080')).toEqual({
            hue: null,
            chroma: 0,
            brightness: 128 / 255,
        });
        expect(measureColor('white')).toEqual({
            hue: null,
            chroma: 0,
            brightness: 1,
        });
        expect(measureColor(chroma.gl(0.3, 0.3, 0.3, 1)).chroma).toBe(0);
    });

    test("gives chroma-js's OKLCH hue", () => {
        const random = seededRandom(1);
        for (let i = 0; i < 2000; i++) {
            const color = chroma.gl(random(), random(), random(), 1);
            const measure = measureColor(color);
            const { C, h } = oklch(color);
            if (measure.hue === null) {
                expect(C).toBeLessThan(1e-4);
            } else {
                expect(Math.abs(hueDifference(measure.hue, h))).toBeLessThan(
                    1e-9,
                );
            }
        }
    });

    test('lifts a color under minBrightness by scaling its channels, as randomizeFrom lifts its seed', () => {
        for (const hex of ['#2b1a12', '#7a1a2b', '#0f4f4a', '#000080']) {
            const lifted = chroma(hex).set('hsv.v', 0.537);
            const measure = measureColor(hex, { minBrightness: 0.537 });
            const expected = measureColor(lifted);
            expect(measure.brightness).toBeCloseTo(0.537, 15);
            expect(hueDifference(measure.hue!, expected.hue!)).toBeCloseTo(
                0,
                9,
            );
            expect(measure.chroma).toBeCloseTo(expected.chroma, 9);
        }
        // brighter colors are left as they are
        expect(measureColor('#e8b450', { minBrightness: 0.5 })).toEqual(
            measureColor('#e8b450'),
        );
        // black lifts to grey
        expect(measureColor('black', { minBrightness: 0.537 })).toEqual({
            hue: null,
            chroma: 0,
            brightness: 0.537,
        });
    });

    test('ignores alpha, and clamps minBrightness to 0–1', () => {
        expect(measureColor('#ff000080')).toEqual(measureColor('#ff0000'));
        expect(measureColor('#200000', { minBrightness: 3 })).toEqual(
            measureColor('#ff0000'),
        );
        expect(measureColor('#200000', { minBrightness: NaN })).toEqual(
            measureColor('#200000'),
        );
    });

    test('is plain JSON', () => {
        for (const color of ['#000000', '#808080', '#e8b450']) {
            const measure = measureColor(color, { minBrightness: 0.2 });
            expect(JSON.parse(JSON.stringify(measure))).toEqual(measure);
        }
    });
});

describe('maxChroma', () => {
    test('is the chroma of the edge color hsv(θ, 1, V) at the hue', () => {
        for (const value of [1, 0.537, 0.05]) {
            for (let theta = 0; theta < 360; theta += 0.25) {
                const color = edge(theta, value);
                const { C, h } = oklch(color);
                const max = maxChroma(h, value);
                // between azure and blue the edge turns back past blue's hue: those colors are less
                // saturated than the edge color just past blue with the same hue
                const inBlueFold =
                    theta > 225 &&
                    theta < 240 &&
                    hueDifference(h, BLUE_HUE) >= 0;
                if (inBlueFold) {
                    expect(C).toBeLessThan(max);
                } else {
                    expect(C / max).toBeCloseTo(1, 9);
                }
            }
        }
    });

    test('nothing on the surface of the sRGB cube exceeds it', () => {
        const random = seededRandom(2);
        const check = (color: chroma.Color) => {
            const { C, h } = oklch(color);
            if (C < 1e-4) return;
            expect(C).toBeLessThanOrEqual(
                maxChroma(h, valueOf(color)) * (1 + 1e-9),
            );
        };
        for (let i = 0; i < 20_000; i++) {
            const value = 0.001 + 0.999 * random();
            const channels = [random() * value, random() * value, 0];
            channels[2] = value;
            const order = Math.floor(random() * 6);
            const [a, b, c] = channels as [number, number, number];
            const permutations = [
                [a, b, c],
                [a, c, b],
                [b, a, c],
                [b, c, a],
                [c, a, b],
                [c, b, a],
            ];
            const [r, g, bl] = permutations[order]!;
            check(chroma.gl(r!, g!, bl!, 1));
        }
        // densely around blue, where the edge turns back
        for (let r = 0; r <= 0.1; r += 0.0025) {
            for (let g = 0; g <= 0.1; g += 0.0025) {
                check(chroma.gl(r, g, 1, 1));
                check(chroma.gl(r * 0.4, g * 0.4, 0.4, 1));
            }
        }
    });

    test("#0000ff sets the most at blue's hue: the most saturated of the edge's three crossings there", () => {
        expect(maxChroma(BLUE_HUE, 1)).toBeCloseTo(
            oklch(chroma('#0000ff')).C,
            12,
        );
        // an azure-side blue whose hue is past blue's
        const fold = edge(236, 1);
        expect(hueDifference(oklch(fold).h, BLUE_HUE)).toBeGreaterThan(0);
        expect(measureColor(fold).chroma).toBeLessThan(0.995);
        expect(measureColor(fold).chroma).toBeGreaterThan(0.95);
        // just under blue's hue, the most saturated color is an azure-leaning blue, 9 % less saturated
        expect(
            colorFromHue({
                hue: BLUE_HUE - 1e-6,
                brightness: 1,
                chroma: 1,
            }).hex(),
        ).toBe('#0037ff');
        expect(
            maxChroma(BLUE_HUE, 1) / maxChroma(BLUE_HUE - 1e-6, 1),
        ).toBeCloseTo(1.088, 3);
        expect(
            colorFromHue({ hue: BLUE_HUE, brightness: 1, chroma: 1 }).hex(),
        ).toBe('#0000ff');
    });

    test('scales with the cube root of linear light', () => {
        const linear = (value: number) =>
            value <= 0.04045
                ? value / 12.92
                : Math.pow((value + 0.055) / 1.055, 2.4);
        for (const hue of [0, 29.2, 100, 200, 264.1, 300]) {
            for (const value of [0.02, 0.3, 0.8]) {
                expect(maxChroma(hue, value)).toBeCloseTo(
                    maxChroma(hue, 1) * Math.cbrt(linear(value)),
                    12,
                );
            }
        }
    });

    test('is 0 at brightness 0 and for a hue that is not a number, and wraps the hue', () => {
        expect(maxChroma(120, 0)).toBe(0);
        expect(maxChroma(NaN, 1)).toBe(0);
        expect(maxChroma(Infinity, 1)).toBe(0);
        expect(maxChroma(-300, 0.5)).toBe(maxChroma(60, 0.5));
        expect(maxChroma(420, 2)).toBe(maxChroma(60, 1));
    });
});

describe('colorFromHue', () => {
    /** The worst differences between targets and what their colors measure. */
    function roundTrip(
        targets: Iterable<{ hue: number; brightness: number; chroma: number }>,
    ) {
        const worst = { hue: 0, chroma: 0, brightness: 0 };
        for (const target of targets) {
            const color = colorFromHue(target);
            const measure = measureColor(color);
            worst.brightness = Math.max(
                worst.brightness,
                Math.abs(measure.brightness - target.brightness),
            );
            if (measure.hue === null) {
                // too little chroma to have a hue
                expect(oklch(color).C).toBeLessThan(1e-4);
                continue;
            }
            worst.chroma = Math.max(
                worst.chroma,
                Math.abs(measure.chroma - target.chroma),
            );
            worst.hue = Math.max(
                worst.hue,
                Math.abs(hueDifference(measure.hue, target.hue)),
            );
        }
        return worst;
    }

    function* targets(
        n: number,
        seed: number,
        draw: (random: () => number) => {
            hue: number;
            brightness: number;
            chroma: number;
        },
    ) {
        const random = seededRandom(seed);
        for (let i = 0; i < n; i++) {
            yield draw(random);
        }
    }

    test('measures back as its target', () => {
        const worst = roundTrip(
            targets(10_000, 3, (random) => ({
                hue: random() * 360,
                // a tenth of them dark, down to black
                brightness: random() < 0.1 ? random() * 0.02 : random(),
                chroma: random(),
            })),
        );
        expect(worst.hue).toBeLessThan(1e-6);
        expect(worst.chroma).toBeLessThan(1e-6);
        expect(worst.brightness).toBeLessThan(1e-9);
    }, 10_000);

    test('reaches the edge: the most saturated colors measure back too', () => {
        const worst = roundTrip(
            targets(5000, 4, (random) => ({
                hue: random() * 360,
                brightness: 0.01 + 0.99 * random(),
                chroma: 0.95 + 0.05 * random(),
            })),
        );
        expect(worst.hue).toBeLessThan(1e-6);
        expect(worst.chroma).toBeLessThan(1e-6);
        expect(worst.brightness).toBeLessThan(1e-9);
    }, 10_000);

    test('near grey too, around the hue of white', () => {
        // chroma-js's white has an OKLab lightness a hair over 1 (1.000001) and a trace of chroma (3.9e-5) at
        // about 72°, so the palest colors around that hue have a lightness over 1
        const [lightness, a, b] = chroma('#ffffff').oklab();
        expect(lightness).toBeGreaterThan(1);
        const whiteHue = (Math.atan2(b, a) * 180) / Math.PI;
        const worst = roundTrip(
            targets(10_000, 6, (random) => ({
                hue:
                    random() < 0.5
                        ? whiteHue - 5 + 10 * random()
                        : 360 * random(),
                brightness: random() < 0.5 ? 1 : random(),
                chroma: 1e-3 * random(),
            })),
        );
        expect(worst.brightness).toBeLessThan(1e-9);
        for (const hue of [whiteHue - 1, whiteHue, whiteHue + 1]) {
            for (let fraction = 2.2e-4; fraction < 2.5e-4; fraction += 1e-6) {
                const color = colorFromHue({
                    hue,
                    brightness: 1,
                    chroma: fraction,
                });
                expect(valueOf(color)).toBeCloseTo(1, 12);
            }
        }
    }, 10_000);

    test('the blue fold: every relative chroma is a color, and relative chroma runs on across it', () => {
        // just past blue's hue, the colors of one brightness leave out a band of chroma
        const worst = roundTrip(
            targets(5000, 5, (random) => ({
                hue: BLUE_HUE - 0.05 + 0.3 * random(),
                brightness: 0.01 + 0.99 * random(),
                chroma: random() < 0.5 ? random() : 0.85 + 0.15 * random(),
            })),
        );
        expect(worst.hue).toBeLessThan(1e-6);
        expect(worst.chroma).toBeLessThan(1e-6);
        expect(worst.brightness).toBeLessThan(1e-9);

        // no jump at either end of the fold, whatever the chroma (at the far end, where the band of missing
        // chroma closes, it narrows as the square root of the distance, so the colors change steeply there)
        const foldEnd = oklch(edge(231.4, 1)).h;
        expect(foldEnd - BLUE_HUE).toBeCloseTo(0.156, 3);
        for (const hue of [BLUE_HUE, foldEnd]) {
            for (const fraction of [0.3, 0.9, 0.99, 0.999]) {
                const before = colorFromHue({
                    hue: hue - 1e-7,
                    brightness: 0.8,
                    chroma: fraction,
                });
                const after = colorFromHue({
                    hue: hue + 1e-7,
                    brightness: 0.8,
                    chroma: fraction,
                });
                expect(chroma.deltaE(before, after)).toBeLessThan(0.02);
            }
        }
    }, 10_000);

    test('chroma 1 is the edge color exactly, and chroma 0 the grey', () => {
        for (const hex of ['#ff8000', '#00ff40', '#8000ff', '#0000ff']) {
            for (const value of [1, 0.4]) {
                const color = chroma(hex).set('hsv.v', value);
                const { hue } = measureColor(color);
                const drawn = colorFromHue({
                    hue: hue!,
                    brightness: value,
                    chroma: 1,
                });
                drawn.gl().forEach((channel, c) => {
                    expect(channel).toBeCloseTo(color.gl()[c]!, 12);
                });
            }
        }
        expect(
            colorFromHue({ hue: 200, brightness: 0.5, chroma: 0 }).gl(),
        ).toEqual([0.5, 0.5, 0.5, 1]);
    });

    test('brightness 0 is black; out-of-range values are clamped, NaN counts as 0', () => {
        expect(
            colorFromHue({ hue: 40, brightness: 0, chroma: 1 }).gl(),
        ).toEqual([0, 0, 0, 1]);
        expect(
            colorFromHue({ hue: 40, brightness: NaN, chroma: 1 }).gl(),
        ).toEqual([0, 0, 0, 1]);
        expect(
            colorFromHue({ hue: 40, brightness: 2, chroma: 1 }).gl(),
        ).toEqual(colorFromHue({ hue: 40, brightness: 1, chroma: 1 }).gl());
        expect(
            colorFromHue({ hue: 40, brightness: 0.5, chroma: -1 }).gl(),
        ).toEqual([0.5, 0.5, 0.5, 1]);
        expect(
            colorFromHue({ hue: 40, brightness: 0.5, chroma: NaN }).gl(),
        ).toEqual([0.5, 0.5, 0.5, 1]);
        expect(
            colorFromHue({ hue: NaN, brightness: 0.5, chroma: 1 }).gl(),
        ).toEqual([0.5, 0.5, 0.5, 1]);
        expect(
            colorFromHue({ hue: 400, brightness: 0.5, chroma: 0.7 }).gl(),
        ).toEqual(colorFromHue({ hue: 40, brightness: 0.5, chroma: 0.7 }).gl());
    });
});
