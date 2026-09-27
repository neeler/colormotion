import { describe, expect, test } from 'vitest';
import {
    AnalyzeOptions,
    Relationship,
    ThemeAnalysis,
    analyzeTheme,
    colorFromHue,
    measureColor,
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

/** The brightness (HSV value) of a quarter of full linear light: an LED floor. */
const FLOOR = 0.537;

/** Five-color themes, as an LED piece would use them, and the relationship each has. */
const THEMES: Record<string, { colors: string[]; relationship: Relationship }> =
    {
        crimson: {
            colors: ['#c8102e', '#ff5a5a', '#5a0a14', '#ff2d6b', '#2a0508'],
            relationship: 'family',
        },
        dusk: {
            colors: ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'],
            relationship: 'bridge',
        },
        emerald: {
            colors: ['#2b8f6b', '#9fe0c0', '#0f4f4a', '#3fb28a', '#123024'],
            relationship: 'family',
        },
        gold: {
            colors: ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'],
            relationship: 'accent',
        },
        sodium: {
            colors: ['#ff9a1f', '#ffd27a', '#b8450e', '#ff7a2a', '#3a1d05'],
            relationship: 'family',
        },
    };

/** The signed difference between two hues, in degrees, from −180 to 180. */
function hueDifference(a: number, b: number) {
    const d = (((a - b) % 360) + 540) % 360;
    return d - 180;
}

/** Every number in a value, however deep. */
function numbersIn(value: unknown): number[] {
    if (typeof value === 'number') return [value];
    if (Array.isArray(value)) return value.flatMap(numbersIn);
    if (value && typeof value === 'object') {
        return Object.values(value).flatMap(numbersIn);
    }
    return [];
}

/** The groups as sets of colors (by their hex), for comparing analyses of the same colors in another order. */
function groupsByColor(analysis: ThemeAnalysis, colors: string[]) {
    return analysis.groups
        .map((group) =>
            group.members
                .map((member) => colors[member]!)
                .sort()
                .join(' '),
        )
        .sort();
}

describe('the concept themes', () => {
    for (const [name, { colors, relationship }] of Object.entries(THEMES)) {
        test(`${name} is ${relationship}, as given and at the floor`, () => {
            for (const minBrightness of [0, FLOOR]) {
                expect(
                    analyzeTheme(colors, { minBrightness }).relationship,
                ).toBe(relationship);
            }
        });
    }

    test('gold & oxblood: gold and brass against oxblood, 63° apart, with the umber muted and following the oxblood', () => {
        const analysis = analyzeTheme(THEMES.gold!.colors, {
            minBrightness: FLOOR,
        });
        expect(analysis.groups.map((group) => group.members)).toEqual([
            [3, 0, 1], // brass, gold, champagne: the anchor's group
            [2, 4], // oxblood, umber
        ]);
        expect(analysis.picks.map((pick) => pick.role)).toEqual([
            'structural',
            'muted',
            'structural',
            'structural',
            'muted',
        ]);
        expect(analysis.anchor).toBeCloseTo(79.2, 1);
        expect(analysis.groups[1]!.center).toBeCloseTo(16.5, 1);
        expect(analysis.span).toBeCloseTo(62.7, 1);
        // muted, the umber (0.65 relative chroma, 29° from the oxblood and 32° from the brass) chains
        // nothing: as a structural color, with a wider join, it would chain the two groups into one
        expect(analysis.picks[4]!.chroma).toBeCloseTo(0.65, 2);
        const wider = { minBrightness: FLOOR, familyJoin: 35 };
        expect(analyzeTheme(THEMES.gold!.colors, wider).relationship).toBe(
            'accent',
        );
        expect(
            analyzeTheme(THEMES.gold!.colors, {
                ...wider,
                structuralChroma: 0.6,
            }).relationship,
        ).toBe('family');
    });

    test('dusk: violet, magenta and orange within half the wheel, spanning 108°; the magenta 37° from the violets', () => {
        const analysis = analyzeTheme(THEMES.dusk!.colors, {
            minBrightness: FLOOR,
        });
        expect(analysis.groups.map((group) => group.members)).toEqual([
            [4, 2, 0],
            [3],
            [1],
        ]);
        expect(analysis.span).toBeCloseTo(107.9, 1);
        expect(
            hueDifference(analysis.groups[1]!.center, analysis.anchor!),
        ).toBeCloseTo(40.6, 1);
    });

    test('keep their relationship across familyJoin 22–37° and structuralChroma 0.70–0.80', () => {
        for (const familyJoin of [22, 25, 30, 35, 37]) {
            for (const structuralChroma of [0.7, 0.75, 0.8]) {
                for (const { colors, relationship } of Object.values(THEMES)) {
                    for (const minBrightness of [0, FLOOR]) {
                        expect(
                            analyzeTheme(colors, {
                                minBrightness,
                                familyJoin,
                                structuralChroma,
                            }).relationship,
                        ).toBe(relationship);
                    }
                }
            }
        }
    });
});

describe('cases', () => {
    const cases: [
        string,
        string[],
        Relationship,
        { neutrals?: number[]; duplicates?: [number, number][] }?,
    ][] = [
        ['one red', ['#ff0000'], 'family'],
        ['white', ['#ffffff'], 'neutral', { neutrals: [0] }],
        ['red and white', ['#ff0000', '#ffffff'], 'family', { neutrals: [1] }],
        ['red and blue (125°)', ['#ff0000', '#0000ff'], 'contrast'],
        ['pink and purple (55°)', ['#ff4fa0', '#8a2be2'], 'accent'],
        ['red and orange (24°)', ['#ff0000', '#ff8000'], 'family'],
        ['gold and oxblood (65°)', ['#e8b450', '#7a1a2b'], 'accent'],
        ['teal and orange', ['#008080', '#ff8c00'], 'contrast'],
        ['red, green and blue', ['#ff0000', '#00ff00', '#0000ff'], 'triad'],
        [
            'red, yellow and blue (red to yellow 80.6°)',
            ['#ff0000', '#ffff00', '#0000ff'],
            'pair-accent',
        ],
        [
            'violet, magenta and orange',
            ['#6b2fa0', '#c0409a', '#ff7a1a'],
            'bridge',
        ],
        [
            'two near-identical reds',
            ['#ff0000', '#fe0101'],
            'family',
            { duplicates: [[0, 1]] },
        ],
        [
            'two pastels (structural, with nothing vivid)',
            ['#ffd1dc', '#c1e1ff'],
            'contrast',
        ],
        ['grey and teal', ['#808080', '#0f8f8a'], 'family', { neutrals: [0] }],
        [
            'a rainbow of six',
            ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
            'spectrum',
        ],
        ['no colors', [], 'neutral'],
    ];
    for (const [name, colors, relationship, extra] of cases) {
        test(`${name}: ${relationship}`, () => {
            for (const minBrightness of [0, FLOOR]) {
                const analysis = analyzeTheme(colors, { minBrightness });
                expect(analysis.relationship).toBe(relationship);
                expect(analysis.neutrals).toEqual(extra?.neutrals ?? []);
                expect(analysis.duplicates).toEqual(extra?.duplicates ?? []);
            }
        });
    }

    test('black is neutral, at a minBrightness of 0 and lifted to grey', () => {
        for (const minBrightness of [0, FLOOR]) {
            const analysis = analyzeTheme(['#000000', '#ff0000'], {
                minBrightness,
            });
            expect(analysis.relationship).toBe('family');
            expect(analysis.neutrals).toEqual([0]);
        }
        // a very dark red is neutral as it is (under brightness 0.02), and red once lifted
        expect(analyzeTheme(['#040000']).relationship).toBe('neutral');
        expect(
            analyzeTheme(['#040000'], { minBrightness: FLOOR }).relationship,
        ).toBe('family');
    });

    test('three groups within 90° are a family; spread wider within half the wheel, a bridge', () => {
        const at = (hues: number[]) =>
            hues.map((hue) =>
                colorFromHue({ hue, brightness: 1, chroma: 0.9 }),
            );
        expect(analyzeTheme(at([10, 42, 74])).relationship).toBe('family');
        expect(analyzeTheme(at([10, 42, 74])).groups).toHaveLength(3);
        expect(analyzeTheme(at([10, 50, 110])).relationship).toBe('bridge');
        // two apart, one across: a gap under 90°
        expect(analyzeTheme(at([10, 60, 200])).relationship).toBe(
            'pair-accent',
        );
        expect(analyzeTheme(at([0, 120, 240])).relationship).toBe('triad');
        expect(analyzeTheme(at([0, 90, 180, 270])).relationship).toBe(
            'spectrum',
        );
    });
});

describe('groups', () => {
    const at = (hue: number, chroma = 0.9) =>
        colorFromHue({ hue, brightness: 1, chroma });

    test('chain hues less than familyJoin apart, through 0°', () => {
        const analysis = analyzeTheme([at(350), at(10), at(35)]);
        expect(analysis.relationship).toBe('family');
        expect(analysis.groups).toHaveLength(1);
        expect(analysis.groups[0]!.members).toEqual([0, 1, 2]);
        expect(analysis.groups[0]!.span).toBeCloseTo(45, 6);
        // equal weights: the mean of −10 (350), 10 and 35, around the circle
        expect(analysis.anchor!).toBeCloseTo(35 / 3, 6);
        expect(analysis.picks.map((pick) => pick.offset)).toEqual([
            expect.closeTo(-10 - 35 / 3, 6),
            expect.closeTo(10 - 35 / 3, 6),
            expect.closeTo(35 - 35 / 3, 6),
        ]);
        // a gap of familyJoin or more cuts the chain
        expect(analyzeTheme([at(0), at(30)]).groups).toHaveLength(2);
        expect(analyzeTheme([at(0), at(29.9)]).groups).toHaveLength(1);
    });

    test('center on the mean of their structural hues, weighted by relative chroma', () => {
        const analysis = analyzeTheme([at(20, 1), at(40, 0.8), at(60, 0.4)]);
        // the muted color at 60° follows the group without moving its center
        expect(analysis.picks.map((pick) => pick.role)).toEqual([
            'structural',
            'structural',
            'muted',
        ]);
        expect(analysis.groups[0]!.center).toBeCloseTo(
            (20 * 1 + 40 * 0.8) / 1.8,
            6,
        );
        expect(analysis.groups[0]!.span).toBeCloseTo(40, 6);
        expect(analysis.groups[0]!.weight).toBeCloseTo(2.2, 6);
    });

    test('muted colors join the nearest structural color within attachWithin, or group on their own', () => {
        const near = analyzeTheme([at(20), at(64, 0.4)]);
        expect(near.groups).toHaveLength(1);
        const far = analyzeTheme([at(20), at(66, 0.4), at(80, 0.5)]);
        expect(far.relationship).toBe('accent');
        expect(far.groups.map((group) => group.members)).toEqual([[0], [1, 2]]);
        // a muted color joins by structural colors only, whatever the order: 66° is 46° from the red
        for (const colors of [
            [at(20), at(62, 0.4), at(100, 0.4)],
            [at(100, 0.4), at(62, 0.4), at(20)],
        ]) {
            const analysis = analyzeTheme(colors);
            expect(analysis.groups).toHaveLength(2);
        }
    });

    test('come in order: the anchor, the heaviest, first, then around the wheel from it', () => {
        const analysis = analyzeTheme([at(300), at(20), at(22, 0.95), at(150)]);
        expect(analysis.anchor!).toBeCloseTo(analysis.groups[0]!.center, 9);
        expect(analysis.groups.map((group) => group.members)).toEqual([
            [1, 2],
            [3],
            [0],
        ]);
        // a tie in weight goes to the group holding the earliest color
        expect(analyzeTheme([at(200), at(20)]).anchor!).toBeCloseTo(200, 6);
        expect(analyzeTheme([at(20), at(200)]).anchor!).toBeCloseTo(20, 6);
    });

    test('with no vivid color, every color that is not neutral is structural', () => {
        const analysis = analyzeTheme(['#ffd1dc', '#c1e1ff', '#e0e0e0']);
        expect(analysis.picks.map((pick) => pick.role)).toEqual([
            'structural',
            'structural',
            'neutral',
        ]);
    });
});

describe('the result', () => {
    test('measures each color as shown: lifted to minBrightness', () => {
        const analysis = analyzeTheme(['#5a0a14'], { minBrightness: FLOOR });
        const measure = measureColor('#5a0a14', { minBrightness: FLOOR });
        expect(analysis.picks[0]).toMatchObject({
            index: 0,
            hue: measure.hue,
            chroma: measure.chroma,
            brightness: expect.closeTo(FLOOR, 12),
            role: 'structural',
            group: 0,
            offset: 0,
        });
    });

    test('fills in the options, and takes the defaults for values that are not finite numbers', () => {
        const defaults: Required<AnalyzeOptions> = {
            minBrightness: 0,
            neutralChroma: 0.12,
            structuralChroma: 0.75,
            familyJoin: 30,
            attachWithin: 45,
            contrastFrom: 90,
            duplicateDeltaE: 3,
        };
        expect(analyzeTheme(['#ff0000']).options).toEqual(defaults);
        expect(
            analyzeTheme(['#ff0000'], {
                minBrightness: NaN,
                familyJoin: Infinity,
                contrastFrom: 60,
            }).options,
        ).toEqual({ ...defaults, contrastFrom: 60 });
        expect(
            analyzeTheme(['#ff0000'], { minBrightness: 2 }).options
                .minBrightness,
        ).toBe(1);
    });

    test('is plain JSON, with no NaN', () => {
        const random = seededRandom(3);
        const sets = [
            ...Object.values(THEMES).map((theme) => theme.colors),
            [],
            ['#000000'],
            ['#ffffff', '#808080'],
            ...Array.from({ length: 200 }, () =>
                Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
                    randomColor({ random }).hex(),
                ),
            ),
        ];
        for (const colors of sets) {
            for (const minBrightness of [0, FLOOR]) {
                const analysis = analyzeTheme(colors, { minBrightness });
                expect(JSON.parse(JSON.stringify(analysis))).toEqual(analysis);
                expect(
                    numbersIn(analysis).every((n) => Number.isFinite(n)),
                ).toBe(true);
            }
        }
    });

    test('is the same with every hue turned by the same angle', () => {
        const random = seededRandom(5);
        const sets = [
            ...Object.values(THEMES).map((theme) => theme.colors),
            ...Array.from({ length: 300 }, () =>
                Array.from({ length: 1 + Math.floor(random() * 5) }, () =>
                    randomColor({ random, constraint: {} }).hex(),
                ),
            ),
        ];
        for (const colors of sets) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const angle = random() * 360;
            // each color as shown, turned: the same brightness and relative chroma at the new hue
            const turned = analysis.picks.map(({ hue, brightness, chroma }) =>
                colorFromHue({
                    hue: (hue ?? 0) + angle,
                    brightness,
                    chroma: hue === null ? 0 : chroma,
                }),
            );
            const after = analyzeTheme(turned, { minBrightness: FLOOR });
            expect(after.relationship).toBe(analysis.relationship);
            expect(after.groups.map((group) => group.members)).toEqual(
                analysis.groups.map((group) => group.members),
            );
            if (analysis.anchor !== null) {
                expect(
                    hueDifference(after.anchor!, analysis.anchor + angle),
                ).toBeCloseTo(0, 6);
            }
        }
    });

    test('is the same whatever the order of the colors, but for the tie-break of the anchor', () => {
        const random = seededRandom(7);
        const sets = [
            ...Object.values(THEMES).map((theme) => theme.colors),
            ...Array.from({ length: 300 }, () =>
                Array.from({ length: 2 + Math.floor(random() * 5) }, () =>
                    randomColor({ random }).hex(),
                ),
            ),
        ];
        for (const colors of sets) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const shuffled = [...colors];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
            }
            const after = analyzeTheme(shuffled, { minBrightness: FLOOR });
            expect(after.relationship).toBe(analysis.relationship);
            expect(groupsByColor(after, shuffled)).toEqual(
                groupsByColor(analysis, colors),
            );
            const weights = analysis.groups.map((group) => group.weight);
            const tied = weights.some(
                (weight, g) => g > 0 && Math.abs(weight - weights[0]!) < 1e-9,
            );
            if (analysis.anchor !== null && !tied) {
                expect(
                    hueDifference(after.anchor!, analysis.anchor),
                ).toBeCloseTo(0, 9);
            }
        }
    });
});
