import chroma, { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    ColorConstraint,
    ColorPalette,
    RandomLikeOptions,
    RelationshipTemplate,
    Theme,
    analyzeTheme,
    hueArc,
    meetsConstraint,
    randomColor,
    randomLike,
    relationshipTemplate,
} from '../src';

/*
 * candidateBudget: a bound on the candidates a random call looks at to keep its colors deltaEThreshold apart.
 * Left out (or NaN), every draw is as in 4.2 (random.compat.test.ts pins them); given, each color looks at
 * the first of the candidates it looks at without one, so a budget only ever cuts the search short.
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

const rgb = (color: Color) => color.rgb(false);

/** The distance from a color to the nearest of awayFrom, measured as the search measures it. */
function nearest(color: Color, awayFrom: readonly string[]) {
    return Math.min(
        ...awayFrom.map((c) => chroma.deltaE(chroma(c), color, 1, 1, 1)),
    );
}

/** The first `count` candidates a search looks at: randomColor with nothing to keep from, one after another. */
function candidates(
    seed: number,
    count: number,
    options: { constraint?: ColorConstraint; minBrightness?: number },
) {
    const random = seededRandom(seed);
    return Array.from({ length: count }, () =>
        randomColor({ ...options, random }),
    );
}

/** A slot a degree wide at a high brightness: most thresholds cannot be met there. */
const NARROW: ColorConstraint = {
    hues: [{ center: 115, width: 0.5 }],
    chroma: { min: 0.6 },
};

/** Single draws: in HSV, in OKLCH, in a narrow slot and in a hue arc. */
const CASES: {
    constraint?: ColorConstraint;
    awayFrom: string[];
    minBrightness?: number;
}[] = [
    { awayFrom: ['#808080'] },
    { awayFrom: ['#c8102e', '#ff5a5a'], constraint: {} },
    { awayFrom: ['#808a0c'], constraint: NARROW, minBrightness: 0.8 },
    {
        awayFrom: ['#48b254', '#808a0c'],
        constraint: { hues: [hueArc(100, 150)] },
        minBrightness: 0.5,
    },
];

/** Five colors in and around NARROW: a color drawn in NARROW next to any of them is rarely 20 ΔE away. */
const OLIVES = ['#e1ef7b', '#c2d114', '#f1ff93', '#bfcd17', '#ecfa8c'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];

/** The brightness (HSV value) of 60 % of full linear light: 0.7977377330312598. */
const F = 1.055 * 0.6 ** (1 / 2.4) - 0.055;

/*
 * The costliest case known: olive and green (an accent, 30.5° apart, whose adjacent slots are about ±0.25°
 * wide) grown to 8 colors and placed as a wild roll at F. Without a budget, most colors cannot reach 20 ΔE
 * from the one before them and pay all 100 candidates, in every attempt.
 */
const OLIVE_GREEN = analyzeTheme(['#808a0c', '#48b254'], { minBrightness: F });
const WILD = relationshipTemplate(OLIVE_GREEN, { nColors: 8, hueWidth: 8 });
const A = OLIVE_GREEN.anchor!;
const COSTLY: RandomLikeOptions = {
    minBrightness: F,
    anchor: [hueArc(A + 30, A + 90), hueArc(A - 90, A - 30)],
    mirror: true,
    avoid: [hueArc(95, 135)],
};

/** A randomLike call with a counting random: what it gives, and its calls to random. */
function like(
    source: RelationshipTemplate,
    seed: number,
    options: RandomLikeOptions,
) {
    const random = counting(seededRandom(seed));
    const result = randomLike(source, { ...options, random });
    return {
        colors: result.colors.map(rgb),
        anchor: result.anchor,
        mirrored: result.mirrored,
        verified: result.verified,
        constraints: result.constraints,
        calls: random.calls,
        hexes: result.colors.map((color) => color.hex()),
    };
}

/** A palette with a counting random. */
function makePalette(seed: number, deltaEThreshold?: number) {
    const random = counting(seededRandom(seed));
    const palette = new ColorPalette({
        colors: OLIVES,
        mode: 'oklch',
        nSteps: 16,
        deltaEThreshold,
        random,
    });
    return { palette, random };
}

/** A palette's colors, without the closing repeat of the first, at full precision. */
const channelsOf = (palette: Readonly<ColorPalette>) =>
    palette.colors.slice(0, palette.nColors).map(rgb);

/** Every way of leaving the budget out. */
const NO_BUDGET: { candidateBudget?: number }[] = [
    {},
    { candidateBudget: undefined },
    { candidateBudget: NaN },
];

describe('candidateBudget', { timeout: 30_000 }, () => {
    test('left out, undefined or NaN, every entry point draws as in 4.2', () => {
        /** The same draws and calls however the budget is left out. */
        const same = (
            draw: (budget: { candidateBudget?: number }) => unknown,
        ) => {
            const [without, ...others] = NO_BUDGET.map(draw);
            for (const other of others) {
                expect(other).toEqual(without);
            }
        };

        for (let seed = 1; seed <= 30; seed++) {
            for (const { awayFrom, constraint, minBrightness } of CASES) {
                for (const deltaEThreshold of [20, 1000, NaN]) {
                    same((budget) => {
                        const random = counting(seededRandom(seed));
                        const color = randomColor({
                            random,
                            awayFrom,
                            constraint,
                            minBrightness,
                            deltaEThreshold,
                            ...budget,
                        });
                        return [rgb(color), random.calls];
                    });
                }
            }
        }

        for (let seed = 1; seed <= 20; seed++) {
            same((budget) => like(WILD, seed, { ...COSTLY, ...budget }));
        }

        const options = { minBrightness: 0.8, constraints: NARROW };
        for (let seed = 1; seed <= 5; seed++) {
            same((budget) => {
                const random = counting(seededRandom(seed));
                const palette = ColorPalette.random({
                    nColors: 8,
                    mode: 'rgb',
                    nSteps: 16,
                    random,
                    ...options,
                    ...budget,
                });
                return [channelsOf(palette), random.calls];
            });
            const methods: ((
                palette: ColorPalette,
                budget: { candidateBudget?: number },
            ) => ColorPalette)[] = [
                (p, budget) => p.randomize({ ...options, ...budget }),
                (p, budget) =>
                    p.randomizeFrom('#808a0c', { ...options, ...budget }),
                (p, budget) => p.pushRandom({ ...options, ...budget }),
                (p, budget) => p.rotateRandomOn({ ...options, ...budget }),
            ];
            for (const method of methods) {
                same((budget) => {
                    const { palette, random } = makePalette(seed);
                    return [channelsOf(method(palette, budget)), random.calls];
                });
            }

            same((budget) => {
                const random = counting(seededRandom(seed));
                const theme = new Theme({
                    nColors: 8,
                    mode: 'oklch',
                    nSteps: 16,
                    random,
                    ...options,
                    ...budget,
                });
                return [channelsOf(theme.palette), random.calls];
            });
            const themeMethods: ((
                theme: Theme,
                budget: { candidateBudget?: number },
            ) => void)[] = [
                (t, budget) =>
                    t.randomTheme({
                        ...options,
                        ...budget,
                        transitionDuration: 0,
                    }),
                (t, budget) =>
                    t.randomFrom('#808a0c', {
                        ...options,
                        ...budget,
                        transitionDuration: 0,
                    }),
                (t, budget) =>
                    t.pushRandomColor({
                        ...options,
                        ...budget,
                        transitionDuration: 0,
                    }),
                (t, budget) =>
                    t.rotateRandomColor({
                        ...options,
                        ...budget,
                        transitionDuration: 0,
                    }),
            ];
            for (const method of themeMethods) {
                same((budget) => {
                    const random = counting(seededRandom(seed));
                    const theme = new Theme({
                        colors: OLIVES,
                        mode: 'oklch',
                        nSteps: 16,
                        random,
                    });
                    method(theme, budget);
                    return [channelsOf(theme.palette), random.calls];
                });
            }
        }
    });

    test('a budget of 99 or more is the 4.2 search for one color', () => {
        for (let seed = 1; seed <= 30; seed++) {
            for (const { awayFrom, constraint, minBrightness } of CASES) {
                for (const deltaEThreshold of [20, 1000]) {
                    const options = {
                        awayFrom,
                        constraint,
                        minBrightness,
                        deltaEThreshold,
                    };
                    const legacy = counting(seededRandom(seed));
                    const color = rgb(
                        randomColor({ ...options, random: legacy }),
                    );
                    for (const candidateBudget of [99, 1000, Infinity]) {
                        const random = counting(seededRandom(seed));
                        expect(
                            rgb(
                                randomColor({
                                    ...options,
                                    random,
                                    candidateBudget,
                                }),
                            ),
                        ).toEqual(color);
                        expect(random.calls).toBe(legacy.calls);
                    }
                }
            }
        }

        // a threshold out of reach, in a narrow slot next to olive
        const pin = (candidateBudget?: number) => {
            const random = counting(seededRandom(1));
            const color = randomColor({
                random,
                constraint: NARROW,
                minBrightness: 0.8,
                awayFrom: ['#808a0c'],
                deltaEThreshold: 1000,
                candidateBudget,
            });
            return { color, calls: random.calls };
        };
        const expectPin = (
            candidateBudget: number | undefined,
            hex: string,
            channels: [number, number, number],
            calls: number,
        ) => {
            const { color, calls: made } = pin(candidateBudget);
            expect(color.hex()).toBe(hex);
            rgb(color).forEach((channel, i) =>
                expect(channel).toBeCloseTo(channels[i]!, 5),
            );
            expect(made).toBe(calls);
        };
        const furthest: [number, number, number] = [
            236.719949, 253.862788, 53.566872,
        ];
        for (const candidateBudget of [undefined, 99, 1000, Infinity]) {
            expectPin(candidateBudget, '#edfe36', furthest, 300);
        }
        // the furthest of the first 99 is the furthest of the 100
        expectPin(98, '#edfe36', furthest, 297);
        expectPin(29, '#ebfc11', [234.778473, 252.392942, 16.944911], 90);
        expectPin(0, '#ddec5e', [221.158069, 235.980771, 93.508469], 3);
    });

    test("one color looks at no more than 1 + budget of 4.2's candidates", () => {
        for (let seed = 1; seed <= 30; seed++) {
            for (const { awayFrom, constraint, minBrightness } of CASES) {
                for (const deltaEThreshold of [20, 1000]) {
                    const options = {
                        awayFrom,
                        constraint,
                        minBrightness,
                        deltaEThreshold,
                    };
                    // 4.2's search: where it stops, and whether it reaches the threshold
                    const legacy = counting(seededRandom(seed));
                    const old = randomColor({ ...options, random: legacy });
                    const oldReached =
                        nearest(old, awayFrom) >= deltaEThreshold;
                    const oldIndex = legacy.calls / 3 - 1;

                    for (const candidateBudget of [0, 1, 5, 29, 98]) {
                        const random = counting(seededRandom(seed));
                        const color = randomColor({
                            ...options,
                            random,
                            candidateBudget,
                        });
                        const cap = 1 + candidateBudget;
                        expect(random.calls % 3).toBe(0);
                        expect(random.calls).toBeLessThanOrEqual(3 * cap);
                        if (deltaEThreshold === 1000) {
                            expect(random.calls).toBe(3 * cap);
                        }

                        const looked = candidates(seed, random.calls / 3, {
                            constraint,
                            minBrightness,
                        });
                        const distances = looked.map((c) =>
                            nearest(c, awayFrom),
                        );
                        const kept = looked.findIndex(
                            (c) => rgb(c).join() === rgb(color).join(),
                        );
                        expect(kept).toBeGreaterThanOrEqual(0);

                        if (oldReached && oldIndex < cap) {
                            // 4.2 stops within the budget: the same color
                            expect(rgb(color)).toEqual(rgb(old));
                            expect(random.calls).toBe(legacy.calls);
                        } else {
                            // the furthest of those looked at, the earliest of equals
                            expect(looked.length).toBe(cap);
                            const furthest = Math.max(...distances);
                            expect(kept).toBe(distances.indexOf(furthest));
                        }
                        // never reaches the threshold where 4.2 does not
                        if (!oldReached) {
                            expect(nearest(color, awayFrom)).toBeLessThan(
                                deltaEThreshold,
                            );
                        }
                    }
                }
            }
        }
    });

    test('edges', () => {
        // nothing to keep from, with a NaN threshold: the first candidate, which 4.2 keeps after 100
        const draw = (candidateBudget?: number) => {
            const random = counting(seededRandom(1));
            const color = randomColor({
                random,
                deltaEThreshold: NaN,
                candidateBudget,
            });
            return {
                hex: color.hex(),
                channels: rgb(color),
                calls: random.calls,
            };
        };
        expect(draw()).toMatchObject({ hex: '#a04d4c', calls: 300 });
        expect(draw(1000)).toEqual({ ...draw(), calls: 3 });
        expect(draw(0)).toEqual({ ...draw(), calls: 3 });

        // every distance NaN: the first candidate, where 4.2 draws a 101st
        const nan = (candidateBudget?: number) => {
            const random = counting(seededRandom(1));
            const color = randomColor({
                random,
                awayFrom: [chroma.rgb(NaN, NaN, NaN)],
                candidateBudget,
            });
            return { hex: color.hex(), calls: random.calls };
        };
        expect(nan()).toEqual({ hex: '#a093c2', calls: 303 });
        expect(nan(1000)).toEqual({ hex: '#a04d4c', calls: 300 });
        expect(nan(0)).toEqual({ hex: '#a04d4c', calls: 3 });

        for (let seed = 1; seed <= 10; seed++) {
            for (const { awayFrom, constraint, minBrightness } of CASES) {
                const single = (candidateBudget?: number) => {
                    const random = counting(seededRandom(seed));
                    const color = randomColor({
                        random,
                        awayFrom,
                        constraint,
                        minBrightness,
                        deltaEThreshold: 1000,
                        candidateBudget,
                    });
                    return [rgb(color), random.calls];
                };
                // below 0 counts as 0, and a fraction is rounded down
                expect(single(-5)).toEqual(single(0));
                expect(single(-Infinity)).toEqual(single(0));
                expect(single(4.9)).toEqual(single(4));
                // NaN: no budget; Infinity: up to 100 candidates
                expect(single(NaN)).toEqual(single());
                expect(single(Infinity)).toEqual(single());
                expect(single(Infinity)[1]).toBe(300);
            }
        }

        // Infinity in a palette: up to 100 candidates for each color
        const palette = (candidateBudget?: number) => {
            const random = counting(seededRandom(2));
            const colors = channelsOf(
                ColorPalette.random({
                    nColors: 8,
                    mode: 'rgb',
                    nSteps: 16,
                    random,
                    minBrightness: 0.8,
                    constraints: NARROW,
                    deltaEThreshold: 1000,
                    candidateBudget,
                }),
            );
            return [colors, random.calls];
        };
        expect(palette(Infinity)).toEqual(palette());
        expect(palette()[1]).toBe(3 + 7 * 300);
    });

    test("randomLike's calls stay within attempts × (a + m + 3n) + 3 × budget", () => {
        const n = WILD.slots.length;
        expect(n).toBe(8);
        const placements: {
            options: RandomLikeOptions;
            a: number;
            m: number;
        }[] = [
            { options: COSTLY, a: 1, m: 1 },
            // a fixed anchor, never mirrored: no calls but the colors'
            {
                options: { ...COSTLY, anchor: A + 60, mirror: false },
                a: 0,
                m: 0,
            },
        ];
        for (const { options, a, m } of placements) {
            for (const candidateBudget of [0, 50, 700, 1000]) {
                for (const deltaEThreshold of [20, 1e9]) {
                    for (const attempts of [1, 16]) {
                        const bound =
                            attempts * (a + m + 3 * n) + 3 * candidateBudget;
                        const legacyBound =
                            attempts * (a + m + 3 + 300 * (n - 1));
                        for (let seed = 1; seed <= 20; seed++) {
                            const { calls } = like(WILD, seed, {
                                ...options,
                                deltaEThreshold,
                                attempts,
                                candidateBudget,
                            });
                            expect(calls).toBeLessThanOrEqual(
                                Math.min(bound, legacyBound),
                            );
                        }
                    }
                }
            }
        }

        // out of reach, one attempt: the first color, then 500 candidates (half the budget) for the other 7
        for (const seed of [1, 2, 3]) {
            expect(
                like(WILD, seed, {
                    ...COSTLY,
                    deltaEThreshold: 1e9,
                    attempts: 1,
                    candidateBudget: 1000,
                }).calls,
            ).toBe(2 + 24 + 3 * 500);
        }

        // out of reach and never verified (at a floor of 0, dark colors break the groups): near the bound
        const never = like(WILD, 12, {
            ...COSTLY,
            minBrightness: 0,
            deltaEThreshold: 1e9,
            attempts: 16,
            candidateBudget: 1000,
        });
        expect(never.verified).toBe(false);
        expect(never.calls).toBe(3413);
        expect(never.calls).toBeLessThanOrEqual(16 * 26 + 3000);

        const pinned = like(WILD, 1, { ...COSTLY, candidateBudget: 1000 });
        expect(pinned).toMatchObject({
            calls: 2302,
            verified: true,
            anchor: 50.98582768561448,
            mirrored: false,
            hexes: [
                '#ea7927',
                '#d06715',
                '#f79151',
                '#ce681f',
                '#f9b610',
                '#cc9d40',
                '#ffc349',
                '#cd9508',
            ],
        });
    });

    test('attempts: 1 replays the first attempt with a budget', () => {
        let compared = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const draw = (attempts: number) => {
                const { colors, anchor, mirrored, verified } = like(
                    WILD,
                    seed,
                    { ...COSTLY, attempts, candidateBudget: 1000 },
                );
                return { colors, anchor, mirrored, verified };
            };
            const once = draw(1);
            if (once.verified) {
                compared++;
                expect(draw(16)).toEqual(once);
            }
        }
        expect(compared).toBeGreaterThanOrEqual(10);
    });

    test("a first attempt of up to 5 colors is 4.2's at 1000", () => {
        const dusk = analyzeTheme(DUSK, { minBrightness: 0.537 });
        const oliveGreen5 = relationshipTemplate(OLIVE_GREEN, {
            nColors: 5,
            hueWidth: 8,
        });
        const sources: [RelationshipTemplate, RandomLikeOptions][] = [
            [
                relationshipTemplate(dusk, { hueWidth: 8 }),
                {
                    minBrightness: 0.537,
                    anchor: [
                        hueArc(dusk.anchor! + 30, dusk.anchor! + 90),
                        hueArc(dusk.anchor! - 90, dusk.anchor! - 30),
                    ],
                    avoid: [hueArc(95, 135)],
                },
            ],
            // where colors do pay all 100 candidates
            [oliveGreen5, COSTLY],
        ];
        for (const [template, options] of sources) {
            expect(template.slots.length).toBe(5);
            let fullSearches = 0;
            for (let seed = 1; seed <= 50; seed++) {
                const without = like(template, seed, {
                    ...options,
                    attempts: 1,
                });
                expect(
                    like(template, seed, {
                        ...options,
                        attempts: 1,
                        candidateBudget: 1000,
                    }),
                ).toEqual(without);
                if (without.calls >= 2 + 3 * 5 + 3 * 99) {
                    fullSearches++;
                }
            }
            if (template === oliveGreen5) {
                expect(fullSearches).toBeGreaterThan(0);
            }
        }
    });

    test('every color meets its slot constraint, and the result is a pure function of the inputs and random', () => {
        for (const candidateBudget of [0, 1000]) {
            for (let seed = 1; seed <= 20; seed++) {
                const options = { ...COSTLY, candidateBudget };
                const random = seededRandom(seed);
                const result = randomLike(WILD, { ...options, random });
                result.colors.forEach((color, i) =>
                    expect(
                        meetsConstraint(color, result.constraints[i]!, {
                            minBrightness: F,
                        }),
                    ).toBe(true),
                );
                expect(like(WILD, seed, options)).toEqual(
                    like(WILD, seed, options),
                );
            }
        }
    });

    test('a neutral source draws once and may use the whole budget', () => {
        const greys = relationshipTemplate(
            analyzeTheme(['#808080', '#a0a0a0', '#404040']),
        );
        expect(greys.relationship).toBe('neutral');
        const n = greys.slots.length;
        for (const deltaEThreshold of [20, 1e9]) {
            for (const candidateBudget of [0, 10, 1000]) {
                for (let seed = 1; seed <= 10; seed++) {
                    const { calls, verified } = like(greys, seed, {
                        deltaEThreshold,
                        candidateBudget,
                    });
                    expect(verified).toBe(true);
                    expect(calls).toBeLessThanOrEqual(
                        3 * n + 3 * candidateBudget,
                    );
                    if (deltaEThreshold === 1e9) {
                        // out of reach: all of it, up to 100 candidates each
                        expect(calls).toBe(
                            3 * n + 3 * Math.min(candidateBudget, 99 * (n - 1)),
                        );
                    }
                }
            }
        }
    });

    test('palettes share one budget per call', () => {
        const random8 = (candidateBudget?: number) => {
            const random = counting(seededRandom(3));
            const palette = ColorPalette.random({
                nColors: 8,
                mode: 'rgb',
                nSteps: 64,
                random,
                minBrightness: 0.8,
                constraints: NARROW,
                candidateBudget,
            });
            return { colors: channelsOf(palette), calls: random.calls };
        };
        const without = random8();
        expect(without.calls).toBe(2103);
        expect(random8(1000)).toEqual(without);
        // every color its first candidate
        const none = random8(0);
        expect(none.calls).toBe(24);
        expect(none.colors).toEqual(
            candidates(3, 8, { constraint: NARROW, minBrightness: 0.8 }).map(
                rgb,
            ),
        );
        // 7 colors share 100: exactly the bound, 3 + 3 × (7 + 100)
        expect(random8(100).calls).toBe(324);

        const options = { minBrightness: 0.8, constraints: NARROW };
        for (const deltaEThreshold of [20, 1000]) {
            for (const candidateBudget of [0, 5, 100, 500, 1000]) {
                for (let seed = 1; seed <= 5; seed++) {
                    const spaced = 4; // the colors after the first of 5
                    const bound =
                        3 * Math.min(100 * spaced, spaced + candidateBudget);
                    const exact = deltaEThreshold === 1000;

                    let { palette, random } = makePalette(
                        seed,
                        deltaEThreshold,
                    );
                    palette.randomize({ ...options, candidateBudget });
                    expect(random.calls).toBeLessThanOrEqual(3 + bound);
                    if (exact) expect(random.calls).toBe(3 + bound);

                    ({ palette, random } = makePalette(seed, deltaEThreshold));
                    palette.randomizeFrom('#808a0c', {
                        ...options,
                        candidateBudget,
                    });
                    expect(random.calls).toBeLessThanOrEqual(bound);
                    if (exact) expect(random.calls).toBe(bound);

                    // a single color: up to 1 + budget candidates, the 4.2 search from 99
                    const single = 3 * Math.min(100, 1 + candidateBudget);
                    for (const method of [
                        'pushRandom',
                        'rotateRandomOn',
                    ] as const) {
                        const drawn = makePalette(seed, deltaEThreshold);
                        const colors = channelsOf(
                            drawn.palette[method]({
                                ...options,
                                candidateBudget,
                            }),
                        );
                        expect(drawn.random.calls).toBeLessThanOrEqual(single);
                        if (exact) expect(drawn.random.calls).toBe(single);
                        if (candidateBudget >= 99) {
                            const legacy = makePalette(seed, deltaEThreshold);
                            expect(colors).toEqual(
                                channelsOf(legacy.palette[method](options)),
                            );
                            expect(drawn.random.calls).toBe(
                                legacy.random.calls,
                            );
                        }
                    }
                }
            }
        }
    });

    test('Theme forwards it to the palette, not to the transition', () => {
        const options = {
            minBrightness: 0.8,
            constraints: NARROW,
            candidateBudget: 0,
        };
        const config = {
            nColors: 8,
            mode: 'rgb' as const,
            nSteps: 16,
            ...options,
        };
        const expected = channelsOf(
            ColorPalette.random({ ...config, random: seededRandom(4) }),
        );
        // 0 is forwarded, not dropped: without it, the colors differ
        expect(expected).not.toEqual(
            channelsOf(
                ColorPalette.random({
                    ...config,
                    candidateBudget: undefined,
                    random: seededRandom(4),
                }),
            ),
        );
        expect(
            channelsOf(
                new Theme({ ...config, random: seededRandom(4) }).palette,
            ),
        ).toEqual(expected);
        expect(
            channelsOf(
                Theme.random({ ...config, random: seededRandom(4) }).palette,
            ),
        ).toEqual(expected);

        const makeTheme = () =>
            new Theme({
                colors: OLIVES,
                mode: 'oklch',
                nSteps: 16,
                random: seededRandom(6),
            });
        const palette = () => makePalette(6).palette;
        const { candidateBudget: _, ...withoutBudget } = options;
        const cases: [
            (theme: Theme) => void,
            (budget: typeof options | typeof withoutBudget) => ColorPalette,
        ][] = [
            [
                (t) => t.randomTheme({ ...options, transitionDuration: 30 }),
                (o) => palette().randomize(o),
            ],
            [
                (t) =>
                    t.randomFrom('#808a0c', {
                        ...options,
                        transitionDuration: 30,
                    }),
                (o) => palette().randomizeFrom('#808a0c', o),
            ],
            [
                (t) =>
                    t.pushRandomColor({ ...options, transitionDuration: 30 }),
                (o) => palette().pushRandom(o),
            ],
            [
                (t) =>
                    t.rotateRandomColor({ ...options, transitionDuration: 30 }),
                (o) => palette().rotateRandomOn(o),
            ],
        ];
        for (const [update, method] of cases) {
            const theme = makeTheme();
            update(theme);
            const target = channelsOf(method(options));
            // 0 is forwarded: without it, the colors differ
            expect(target).not.toEqual(channelsOf(method(withoutBudget)));
            expect(channelsOf(theme.activePalette)).toEqual(target);
            // the transition option still applies: 30 ticks
            expect(theme.isTransitioning).toBe(true);
            for (let i = 0; i < 29; i++) {
                theme.tick(0);
            }
            expect(theme.isTransitioning).toBe(true);
            theme.tick(0);
            expect(theme.isTransitioning).toBe(false);
            expect(channelsOf(theme.palette)).toEqual(target);
        }
    });
});
