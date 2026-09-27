import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    ColorConstraint,
    ColorPalette,
    colorFromHue,
    hueArc,
    measureColor,
    meetsConstraint,
    randomColor,
} from '../src';

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

/** A random function that returns the values given, over and over. */
function scripted(values: number[]) {
    let i = 0;
    return () => values[i++ % values.length]!;
}

/** A random function that counts its calls. */
function counting(random: () => number) {
    const counter = Object.assign(
        () => {
            counter.calls++;
            return random();
        },
        { calls: 0 },
    );
    return counter;
}

/** The random values a constrained draw reads: brightness, then how far along the hues, then chroma. */
const constrainedDraw = (value: number, along: number, chroma: number) => [
    value,
    along,
    chroma,
];

/** The signed difference between two hues, in degrees, from −180 to 180. */
function hueDifference(a: number, b: number) {
    const d = (((a - b) % 360) + 540) % 360;
    return d - 180;
}

function expectMeasure(
    color: chroma.Color,
    expected: { hue: number; chroma: number; brightness: number },
) {
    const measure = measureColor(color);
    expect(hueDifference(measure.hue!, expected.hue)).toBeCloseTo(0, 6);
    expect(measure.chroma).toBeCloseTo(expected.chroma, 9);
    expect(measure.brightness).toBeCloseTo(expected.brightness, 12);
}

describe('hueArc', () => {
    test('runs increasing from one hue to the other, wrapping through 360', () => {
        expect(hueArc(330, 30)).toEqual({ center: 0, width: 60 });
        expect(hueArc(30, 330)).toEqual({ center: 180, width: 300 });
        expect(hueArc(95, 135)).toEqual({ center: 115, width: 40 });
        expect(hueArc(-30, 30)).toEqual({ center: 0, width: 60 });
        expect(hueArc(400, 420)).toEqual({ center: 50, width: 20 });
    });

    test('from a hue to itself is that hue; 360 or more is every hue; NaN is ignored', () => {
        expect(hueArc(40, 40)).toEqual({ center: 40, width: 0 });
        expect(hueArc(0, 360)).toEqual({ center: 180, width: 360 });
        expect(hueArc(10, 1000).width).toBe(360);
        expect(hueArc(0, Infinity).width).toBe(360);
        expect(hueArc(NaN, 10).width).toBeNaN();
        expect(hueArc(10, -Infinity).width).toBeNaN();
    });
});

describe('randomColor', () => {
    test('without a constraint, draws in HSV as the random methods of 4.0 do', () => {
        for (const seed of [1, 2, 3]) {
            const palette = ColorPalette.random({
                nColors: 1,
                minBrightness: 0.4,
                mode: 'rgb',
                nSteps: 4,
                random: seededRandom(seed),
            });
            expect(
                randomColor({
                    random: seededRandom(seed),
                    minBrightness: 0.4,
                }).rgb(false),
            ).toEqual(palette.colors[0]!.rgb(false));
        }
        // value, hue and saturation
        expect(randomColor({ random: scripted([0.5, 0.25, 1]) }).hex()).toBe(
            chroma.hsv(90, 1, 0.5).hex(),
        );
    });

    test('within a constraint, draws brightness, then hue along the allowed arcs, then chroma', () => {
        const color = randomColor({
            random: scripted(constrainedDraw(0.5, 0.25, 0.5)),
            minBrightness: 0.2,
            constraint: {
                hues: [{ center: 100, width: 40 }],
                chroma: { min: 0.6, max: 1 },
            },
        });
        expectMeasure(color, { hue: 90, chroma: 0.8, brightness: 0.6 });
        // {} allows every hue and chroma
        expectMeasure(
            randomColor({
                random: scripted(constrainedDraw(1, 0.5, 0.3)),
                constraint: {},
            }),
            { hue: 180, chroma: 0.3, brightness: 1 },
        );
        // the draw is the color at those measures, at full precision
        expect(
            randomColor({
                random: scripted(constrainedDraw(0.7, 0.1, 0.9)),
                constraint: {},
            }).rgb(false),
        ).toEqual(
            colorFromHue({ hue: 36, brightness: 0.7, chroma: 0.9 }).rgb(false),
        );
    });

    test('takes exactly three calls to random for each candidate', () => {
        const constraints: (ColorConstraint | undefined)[] = [
            undefined,
            {},
            { hues: [hueArc(20, 40)], chroma: { min: 0.8 } },
            { hues: [{ center: 30, width: 0 }], chroma: { min: 1, max: 1 } },
            { avoid: [hueArc(95, 135)] },
        ];
        for (const constraint of constraints) {
            const random = counting(seededRandom(4));
            randomColor({ random, constraint });
            expect(random.calls).toBe(3);

            // an unmet distance draws all 100 candidates
            const strict = counting(seededRandom(5));
            randomColor({
                random: strict,
                constraint,
                awayFrom: ['#808080'],
                deltaEThreshold: 1000,
            });
            expect(strict.calls).toBe(300);
        }
    });

    test('hue arcs wrap through 360 and join as a union, uniform along their length', () => {
        const constraint = {
            hues: [hueArc(350, 10), { center: 100, width: 20 }],
        };
        // the arcs laid end to end, in order of start: [0, 10], [90, 110], [350, 360]
        const hueAt = (along: number) =>
            measureColor(
                randomColor({
                    random: scripted(constrainedDraw(1, along, 1)),
                    constraint,
                }),
            ).hue!;
        expect(hueDifference(hueAt(0.125), 5)).toBeCloseTo(0, 6);
        expect(hueDifference(hueAt(0.5), 100)).toBeCloseTo(0, 6);
        expect(hueDifference(hueAt(0.875), 355)).toBeCloseTo(0, 6);
        // overlapping arcs count once
        const overlapping = {
            hues: [
                { center: 100, width: 20 },
                { center: 110, width: 20 },
            ],
        };
        expect(
            hueDifference(
                measureColor(
                    randomColor({
                        random: scripted(constrainedDraw(1, 0.5, 1)),
                        constraint: overlapping,
                    }),
                ).hue!,
                105,
            ),
        ).toBeCloseTo(0, 6);
    });

    test('avoid takes hues out, and is ignored when it would leave none', () => {
        const random = seededRandom(6);
        const olive = hueArc(95, 135);
        for (let i = 0; i < 300; i++) {
            const { hue } = measureColor(
                randomColor({
                    random,
                    constraint: {
                        avoid: [olive],
                        chroma: { min: 0.3 },
                    },
                }),
            );
            expect(hue! < 95 || hue! > 135).toBe(true);
        }
        // hues 90–110, less 95–135: 90–95
        for (let i = 0; i < 100; i++) {
            const { hue } = measureColor(
                randomColor({
                    random,
                    constraint: {
                        hues: [hueArc(90, 110)],
                        avoid: [olive],
                        chroma: { min: 0.3 },
                    },
                }),
            );
            expect(hue).toBeGreaterThanOrEqual(90 - 1e-6);
            expect(hue).toBeLessThanOrEqual(95 + 1e-6);
        }
        // an avoid covering every allowed hue is ignored
        for (const avoid of [[hueArc(80, 140)], [hueArc(0, 360)]]) {
            const constraint = {
                hues: [hueArc(100, 120)],
                avoid,
                chroma: { min: 0.3 },
            };
            for (let i = 0; i < 50; i++) {
                const color = randomColor({ random, constraint });
                const { hue } = measureColor(color);
                expect(hue).toBeGreaterThanOrEqual(100 - 1e-6);
                expect(hue).toBeLessThanOrEqual(120 + 1e-6);
                expect(meetsConstraint(color, constraint)).toBe(true);
            }
        }
    });

    test('zero-width arcs are single hues, drawn only when every arc has width 0', () => {
        const points = {
            hues: [
                { center: 30, width: 0 },
                { center: 200, width: 0 },
            ],
            chroma: { min: 0.5 },
        };
        const hueAt = (along: number, constraint: ColorConstraint) =>
            measureColor(
                randomColor({
                    random: scripted(constrainedDraw(1, along, 1)),
                    constraint,
                }),
            ).hue!;
        expect(hueDifference(hueAt(0.2, points), 30)).toBeCloseTo(0, 6);
        expect(hueDifference(hueAt(0.7, points), 200)).toBeCloseTo(0, 6);
        // beside an arc of positive width, a single hue has no share
        const mixed = {
            hues: [{ center: 30, width: 0 }, hueArc(100, 120)],
        };
        for (const along of [0, 0.3, 0.99]) {
            const hue = hueAt(along, mixed);
            expect(hue).toBeGreaterThanOrEqual(100 - 1e-6);
            expect(hue).toBeLessThanOrEqual(120 + 1e-6);
        }
        // avoid removes a single hue it covers, unless that would leave none
        expect(
            hueDifference(
                hueAt(0.2, { ...points, avoid: [hueArc(20, 40)] }),
                200,
            ),
        ).toBeCloseTo(0, 6);
        expect(
            hueDifference(
                hueAt(0.2, {
                    hues: [{ center: 30, width: 0 }],
                    avoid: [{ center: 30, width: 0 }],
                }),
                30,
            ),
        ).toBeCloseTo(0, 6);
    });

    test('ranges that are not numbers are ignored; widths of 360 or more are every hue', () => {
        const hueAt = (along: number, constraint: ColorConstraint) =>
            measureColor(
                randomColor({
                    random: scripted(constrainedDraw(1, along, 1)),
                    constraint,
                }),
            ).hue!;
        for (const hues of [
            [{ center: NaN, width: 20 }],
            [{ center: 40, width: NaN }],
            [{ center: Infinity, width: 20 }],
            [{ center: NaN, width: 360 }],
            [{ center: 40, width: Infinity }],
            [],
        ]) {
            expect(hueDifference(hueAt(0.5, { hues }), 180)).toBeCloseTo(0, 6);
        }
        // an ignored range beside a real one leaves the real one
        expect(
            hueDifference(
                hueAt(0.5, {
                    hues: [{ center: NaN, width: 20 }, hueArc(40, 60)],
                }),
                50,
            ),
        ).toBeCloseTo(0, 6);
        // negative widths count as 0
        expect(
            hueDifference(
                hueAt(0.5, { hues: [{ center: 77, width: -5 }] }),
                77,
            ),
        ).toBeCloseTo(0, 6);
    });

    test('chroma bounds are clamped to 0–1, NaN counts as not given, and a max below min swaps', () => {
        const chromaAt = (value: number, range: ColorConstraint['chroma']) =>
            measureColor(
                randomColor({
                    random: scripted(constrainedDraw(1, 0.3, value)),
                    constraint: { chroma: range },
                }),
            ).chroma;
        expect(chromaAt(0.5, { min: 0.8, max: 0.4 })).toBeCloseTo(0.6, 9);
        expect(chromaAt(0.5, { min: -1, max: 2 })).toBeCloseTo(0.5, 9);
        expect(chromaAt(0.5, { min: NaN, max: NaN })).toBeCloseTo(0.5, 9);
        expect(chromaAt(0.5, { min: 0.5 })).toBeCloseTo(0.75, 9);
        expect(chromaAt(0.5, { max: 0.5 })).toBeCloseTo(0.25, 9);
    });

    test('a constraint that allows one color still returns within the cap, and meets it', () => {
        const constraint = {
            hues: [{ center: 250, width: 0 }],
            chroma: { min: 0.9, max: 0.9 },
        };
        const random = counting(seededRandom(7));
        const color = randomColor({
            random,
            minBrightness: 1,
            constraint,
            awayFrom: [colorFromHue({ hue: 250, brightness: 1, chroma: 0.9 })],
        });
        expect(random.calls).toBe(300);
        expect(meetsConstraint(color, constraint)).toBe(true);
        expectMeasure(color, { hue: 250, chroma: 0.9, brightness: 1 });
    });

    test('keeps deltaEThreshold from every color in awayFrom, drawing again when needed', () => {
        const random = seededRandom(8);
        const awayFrom = ['#e8b450', '#7a1a2b'];
        for (let i = 0; i < 200; i++) {
            const color = randomColor({
                random,
                minBrightness: 0.3,
                constraint: { chroma: { min: 0.5 } },
                awayFrom,
                deltaEThreshold: 25,
            });
            for (const other of awayFrom) {
                expect(
                    chroma.deltaE(other, color, 1, 1, 1),
                ).toBeGreaterThanOrEqual(25);
            }
        }
        // the first candidate is too close to red; the second is far from it
        const color = randomColor({
            random: scripted([
                ...constrainedDraw(1, 29.23 / 360, 1),
                ...constrainedDraw(1, 0.5, 1),
            ]),
            constraint: {},
            awayFrom: ['#ff0000'],
        });
        expect(measureColor(color).hue).toBeCloseTo(180, 6);
    });

    test('an unmet distance uses the candidate furthest from its nearest', () => {
        const color = randomColor({
            random: scripted([
                ...constrainedDraw(1, 29.23 / 360, 1), // red: beside red
                ...constrainedDraw(1, 0.5, 1), // cyan-ish: furthest
                ...constrainedDraw(1, 0.1, 1), // close to red
            ]),
            constraint: {},
            awayFrom: ['#ff0000'],
            deltaEThreshold: 1000,
        });
        expect(measureColor(color).hue).toBeCloseTo(180, 6);
    });

    test('is reproducible with a seeded random', () => {
        const draw = () =>
            Array.from({ length: 20 }, (_, i) =>
                randomColor({
                    random: seededRandom(i),
                    minBrightness: 0.537,
                    constraint: { hues: [hueArc(10, 60)] },
                }).hex(),
            );
        expect(draw()).toEqual(draw());
    });
});

describe('meetsConstraint', () => {
    const gold = { hues: [hueArc(70, 90)], chroma: { min: 0.6, max: 0.9 } };

    test('checks relative chroma and hue', () => {
        const at = (hue: number, fraction: number) =>
            colorFromHue({ hue, brightness: 0.8, chroma: fraction });
        expect(meetsConstraint(at(80, 0.75), gold)).toBe(true);
        expect(meetsConstraint(at(70, 0.6), gold)).toBe(true);
        expect(meetsConstraint(at(90, 0.9), gold)).toBe(true);
        expect(meetsConstraint(at(69, 0.75), gold)).toBe(false);
        expect(meetsConstraint(at(91, 0.75), gold)).toBe(false);
        expect(meetsConstraint(at(80, 0.59), gold)).toBe(false);
        expect(meetsConstraint(at(80, 0.91), gold)).toBe(false);
        expect(meetsConstraint(at(80, 0.95), {})).toBe(true);
    });

    test('allows slack in relative chroma, and in hue as much as moves the color that far', () => {
        const at = (hue: number, fraction: number) =>
            colorFromHue({ hue, brightness: 0.8, chroma: fraction });
        expect(meetsConstraint(at(80, 0.904), gold)).toBe(true);
        expect(meetsConstraint(at(80, 0.906), gold)).toBe(false);
        expect(meetsConstraint(at(80, 0.93), gold, { tolerance: 0.05 })).toBe(
            true,
        );
        // at chroma 0.9, 0.005 of chroma is 0.32° of hue
        expect(meetsConstraint(at(90.3, 0.9), gold)).toBe(true);
        expect(meetsConstraint(at(90.35, 0.9), gold)).toBe(false);
        // a less saturated color has more slack in hue
        const muted = { hues: [hueArc(70, 90)], chroma: { max: 0.2 } };
        expect(meetsConstraint(at(92, 0.1), muted)).toBe(true);
        expect(meetsConstraint(at(94, 0.1), muted)).toBe(false);
    });

    test('a color with no hue passes the hue check; minBrightness measures the color as lifted', () => {
        const grey = { hues: [hueArc(0, 10)], chroma: { max: 0.05 } };
        expect(meetsConstraint('#808080', grey)).toBe(true);
        expect(meetsConstraint('#000000', grey)).toBe(true);
        expect(meetsConstraint('#808080', gold)).toBe(false);
        const dark = colorFromHue({ hue: 80, brightness: 0.2, chroma: 0.75 });
        expect(meetsConstraint(dark, gold, { minBrightness: 0.537 })).toBe(
            true,
        );
    });
});
