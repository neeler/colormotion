import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    ColorConstraint,
    RelationshipTemplate,
    TemplateSlot,
    ThemeAnalysis,
    adjacentConstraints,
    analyzeTheme,
    colorFromHue,
    hueArc,
    measureColor,
    meetsConstraint,
    randomColor,
    randomLike,
    relationshipTemplate,
    templateConstraints,
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

/** The brightness (HSV value) of a quarter of full linear light: an LED floor. */
const FLOOR = 0.537;

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
    'a red': ['#ff0000'],
    'red and white': ['#ff0000', '#ffffff'],
    'red and blue': ['#ff0000', '#0000ff'],
    'pink and purple': ['#ff4fa0', '#8a2be2'],
    'gold and oxblood': ['#e8b450', '#7a1a2b'],
    'red, green and blue': ['#ff0000', '#00ff00', '#0000ff'],
    'red, yellow and blue': ['#ff0000', '#ffff00', '#0000ff'],
    'violet, magenta and orange': ['#6b2fa0', '#c0409a', '#ff7a1a'],
};

/** The colors lifted to the floor, at full precision: as a theme with that floor shows them. */
function lifted(colors: string[], floor = FLOOR) {
    return colors.map((color) => {
        const rgb = chroma(color)
            .rgb(false)
            .map((channel) => channel / 255);
        const value = Math.max(...rgb);
        if (value >= floor) return chroma.gl(rgb[0]!, rgb[1]!, rgb[2]!, 1);
        if (value === 0) return chroma.gl(floor, floor, floor, 1);
        return chroma.gl(
            (rgb[0]! * floor) / value,
            (rgb[1]! * floor) / value,
            (rgb[2]! * floor) / value,
            1,
        );
    });
}

/** A color at an OKLCH hue and relative chroma, at full precision. */
function at(hue: number, chroma: number, brightness = 0.8) {
    return colorFromHue({ hue, brightness, chroma });
}

/**
 * A color within a constraint, brightness from FLOOR to 1: half the time at a corner of it (an end of its arc
 * of hue, and an end of its band of chroma), and anywhere within it otherwise.
 */
function atCorner(constraint: ColorConstraint, random: () => number) {
    const arc = constraint.hues?.[0];
    if (!arc || arc.width >= 360 || random() < 0.5) {
        return randomColor({ random, minBrightness: FLOOR, constraint });
    }
    return colorFromHue({
        hue: arc.center + ((random() < 0.5 ? -1 : 1) * arc.width) / 2,
        brightness: FLOOR + random() * (1 - FLOOR),
        chroma:
            random() < 0.5 ? constraint.chroma!.min! : constraint.chroma!.max!,
    });
}

/** The distance between two hues around the circle, 0 to 180. */
function hueDistance(a: number, b: number) {
    const d = (((a - b) % 360) + 360) % 360;
    return Math.min(d, 360 - d);
}

/**
 * Grows picks to n colors: the picks (lifted to the floor) in their own slots, and a color drawn within each
 * other slot's adjacent constraint, kept 20 ΔE from the neighbours already there, in slot order.
 */
function grow(picks: string[], n: number, random: () => number) {
    const colors = lifted(picks);
    const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
    const template = relationshipTemplate(analysis, { nColors: n });
    const constraints = templateConstraints(template, analysis.anchor ?? 0);
    const grown: (chroma.Color | undefined)[] = new Array(
        template.slots.length,
    ).fill(undefined);
    template.pickSlots!.forEach((slot, j) => {
        grown[slot] = colors[j];
    });
    const count = grown.length;
    for (let i = 0; i < count; i++) {
        if (grown[i]) continue;
        grown[i] = randomColor({
            random,
            minBrightness: FLOOR,
            constraint: constraints[i],
            awayFrom: [
                grown[(i + count - 1) % count],
                grown[(i + 1) % count],
            ].filter((color): color is chroma.Color => !!color),
        });
    }
    return { analysis, template, constraints, colors: grown as chroma.Color[] };
}

/** Whether colors have an analysis's relationship and number of groups, measured at the floor. */
function keepsShape(
    colors: chroma.Color[] | string[],
    analysis: ThemeAnalysis,
) {
    const after = analyzeTheme(colors, { minBrightness: FLOOR });
    return (
        after.relationship === analysis.relationship &&
        after.groups.length === analysis.groups.length
    );
}

describe('relationshipTemplate, from an analysis', () => {
    test('has a slot for each color, in order, with its role, offset from the anchor and group', () => {
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const template = relationshipTemplate(analysis);
            expect(template.relationship).toBe(analysis.relationship);
            expect(template.pickSlots).toEqual([0, 1, 2, 3, 4]);
            expect(template.options).toEqual(analysis.options);
            template.slots.forEach((slot, i) => {
                const pick = analysis.picks[i]!;
                expect(slot).toMatchObject({
                    role: pick.role,
                    offset: pick.offset,
                    group: pick.group,
                    pick: i,
                    tint: null,
                });
            });
            expect(template.groups).toEqual(
                analysis.groups.map((group) => ({
                    offset: expect.closeTo(
                        hueDistance(group.center, analysis.anchor!) *
                            Math.sign(
                                ((group.center - analysis.anchor! + 540) %
                                    360) -
                                    180,
                            ),
                        9,
                    ),
                    span: group.span,
                })),
            );
        }
    });

    test('gives a lone pick ±12°, and a band of chroma ±0.2 within its role', () => {
        const template = relationshipTemplate(analyzeTheme(['#ff0000']));
        expect(template.slots).toEqual([
            {
                role: 'structural',
                offset: 0,
                hueWidth: 24,
                tint: null,
                chroma: { min: 0.8, max: 1 },
                group: 0,
                pick: 0,
            },
        ]);
        // a muted pick keeps under structuralChroma, a neutral one under neutralChroma
        const [muted, neutral] = relationshipTemplate(
            analyzeTheme(['#ff0000', '#c08080', '#8a8680']),
        ).slots.slice(1);
        const mutedChroma = measureColor('#c08080').chroma;
        expect(muted!.role).toBe('muted');
        expect(muted!.chroma).toEqual({
            min: expect.closeTo(Math.max(0.15, mutedChroma - 0.2), 12),
            max: expect.closeTo(Math.min(0.72, mutedChroma + 0.2), 12),
        });
        expect(neutral).toMatchObject({
            role: 'neutral',
            offset: null,
            group: null,
            chroma: { min: 0, max: 0.08 },
        });
    });

    test('widens a slot by a quarter of its group span, up to maxHueWidth', () => {
        // gold & oxblood: the champagne (a group span of 8.6°) and the umber (29.1°) follow their groups
        const gold = relationshipTemplate(
            analyzeTheme(THEMES.gold!, { minBrightness: FLOOR }),
        );
        expect(gold.slots[1]!.hueWidth / 2).toBeCloseTo(12 + 8.6 / 4, 1);
        expect(gold.slots[4]!.hueWidth / 2).toBeCloseTo(12 + 29.1 / 4, 1);
        expect(gold.slots[4]!.chroma).toEqual({
            min: expect.closeTo(0.45, 2),
            max: 0.72,
        });
        for (const { hueWidth, offset } of relationshipTemplate(
            analyzeTheme(THEMES.sodium!, { minBrightness: FLOOR }),
            { hueWidth: 30 },
        ).slots) {
            if (offset !== null) expect(hueWidth).toBeLessThanOrEqual(40);
        }
        // hueWidth, minHueWidth and maxHueWidth
        expect(
            relationshipTemplate(analyzeTheme(['#ff0000']), { hueWidth: 30 })
                .slots[0]!.hueWidth,
        ).toBe(40);
        expect(
            relationshipTemplate(analyzeTheme(['#ff0000']), {
                hueWidth: 1,
                minHueWidth: 5,
            }).slots[0]!.hueWidth,
        ).toBe(10);
        expect(
            relationshipTemplate(analyzeTheme(['#ff0000']), {
                chromaWidth: 0.05,
            }).slots[0]!.chroma,
        ).toEqual({ min: 0.95, max: 1 });
    });

    test('keeps structural neighbourhoods of different groups familyJoin apart', () => {
        const random = seededRandom(1);
        const sets = [
            ...Object.values(THEMES),
            ...Object.values(PICKS),
            ...Array.from({ length: 500 }, () =>
                Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
                    randomColor({ random, constraint: {} }).hex(),
                ),
            ),
        ];
        let pairs = 0;
        for (const colors of sets) {
            for (const hueWidth of [8, 12]) {
                const template = relationshipTemplate(
                    analyzeTheme(colors, { minBrightness: FLOOR }),
                    { hueWidth, nColors: 6 },
                );
                const structural = template.slots.filter(
                    (slot) => slot.role === 'structural',
                );
                for (const a of structural) {
                    for (const b of structural) {
                        if (a.group === b.group) continue;
                        const gap =
                            hueDistance(a.offset!, b.offset!) -
                            a.hueWidth / 2 -
                            b.hueWidth / 2;
                        expect(gap).toBeGreaterThanOrEqual(
                            template.options.familyJoin,
                        );
                        pairs++;
                    }
                }
            }
        }
        expect(pairs).toBeGreaterThan(500);
    });

    test('keeps the hues that chain a group, in hue order, less than familyJoin apart', () => {
        for (const colors of Object.values(THEMES)) {
            const template = relationshipTemplate(
                analyzeTheme(colors, { minBrightness: FLOOR }),
                { nColors: 8 },
            );
            template.groups.forEach((_, g) => {
                const chain = template.slots
                    .filter(
                        (slot) =>
                            slot.group === g && slot.role === 'structural',
                    )
                    .sort((a, b) => a.offset! - b.offset!);
                for (let k = 1; k < chain.length; k++) {
                    const furthest =
                        chain[k]!.offset! -
                        chain[k - 1]!.offset! +
                        chain[k]!.hueWidth / 2 +
                        chain[k - 1]!.hueWidth / 2;
                    expect(furthest).toBeLessThan(template.options.familyJoin);
                }
            });
        }
    });

    test('keeps a muted color within attachWithin of a structural slot, narrowing the nearest when it must', () => {
        // a muted color 42° from the vivid one it follows: with the vivid slot ±15°, the vivid color could be
        // drawn 57° away, and the muted one would go off on its own
        const analysis = analyzeTheme([at(145, 0.37), at(187, 0.9)], {
            minBrightness: FLOOR,
        });
        expect(analysis.relationship).toBe('family');
        expect(analysis.picks.map((pick) => pick.role)).toEqual([
            'muted',
            'structural',
        ]);
        const { attachWithin } = analysis.options;
        const random = seededRandom(23);
        for (const hueWidth of [8, 12]) {
            const template = relationshipTemplate(analysis, {
                hueWidth,
                nColors: 5,
            });
            // the vivid pick's own slot narrows; its extras don't have to
            const vivid = template.slots[template.pickSlots![1]!]!;
            expect(42 + vivid.hueWidth / 2).toBeLessThan(attachWithin);
            expect(
                template.slots.filter(
                    (slot) => slot.role === 'structural' && slot.hueWidth > 24,
                ),
            ).toHaveLength(2);
            for (let i = 0; i < 300; i++) {
                const constraints = templateConstraints(
                    template,
                    random() * 360,
                    { mirrored: random() < 0.5 },
                );
                const palette = constraints.map((constraint) =>
                    atCorner(constraint, random),
                );
                expect(keepsShape(palette, analysis)).toBe(true);
            }
        }
    });

    test('narrows the chroma of a group whose weights alone could move its center across a threshold', () => {
        // two pastels 21.5° apart, 87° from a third: a gap 3° under contrastFrom, with 1.5° for each center to
        // move. Weighted by chroma anywhere in their bands (±0.2), the two could move theirs 3.8°.
        const colors = [
            at(270, 0.61, 1),
            at(192.8, 0.49, 1),
            at(291.5, 0.51, 1),
        ];
        const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
        expect(analysis.relationship).toBe('accent');
        const template = relationshipTemplate(analysis);
        for (const i of [0, 2]) {
            const { chroma, hueWidth } = template.slots[i]!;
            const own = analysis.picks[i]!.chroma;
            expect(hueWidth).toBeLessThan(0.01);
            expect(chroma.min!).toBeLessThanOrEqual(own);
            expect(chroma.max!).toBeGreaterThanOrEqual(own);
            expect(chroma.max! - chroma.min!).toBeLessThan(0.3);
        }
        // the third keeps its band, and a little hue
        expect(template.slots[1]!.chroma).toEqual({
            min: expect.closeTo(0.29, 9),
            max: expect.closeTo(0.69, 9),
        });
        expect(template.slots[1]!.hueWidth).toBeGreaterThan(2);
        const random = seededRandom(24);
        for (let i = 0; i < 300; i++) {
            const constraints = templateConstraints(template, random() * 360, {
                mirrored: random() < 0.5,
            });
            const palette = constraints.map((constraint) =>
                atCorner(constraint, random),
            );
            expect(keepsShape(palette, analysis)).toBe(true);
        }
    });

    test('leaves the chroma of a group alone when its extra slots already move its center too far', () => {
        // a contrast pair 3° over contrastFrom. With three slots, the anchor's group narrows its chroma; with
        // four, the extra slot copies one of its two colors, which moves its center across at their own
        // chroma: no band keeps it, and the bands stay as they are
        const analysis = analyzeTheme(
            [at(281.6, 0.836), at(261.4, 0.959), at(177.7, 0.952)],
            { minBrightness: FLOOR },
        );
        expect(analysis.relationship).toBe('contrast');
        const [first] = relationshipTemplate(analysis).slots;
        expect(first!.chroma.max! - first!.chroma.min!).toBeLessThan(0.2);
        for (const slot of relationshipTemplate(analysis, { nColors: 4 })
            .slots) {
            expect(slot.chroma).toEqual({ min: 0.77, max: 1 });
        }
    });

    test('keeps a tinted neutral near its tint, and never rotates or mirrors a neutral slot', () => {
        // a warm grey keeps its tint; white is any hue
        const analysis = analyzeTheme(['#ff0000', '#948f88', '#ffffff']);
        const template = relationshipTemplate(analysis);
        const tint = measureColor('#948f88').hue!;
        expect(template.slots[1]).toMatchObject({
            role: 'neutral',
            tint: expect.closeTo(tint, 9),
            hueWidth: 60,
        });
        expect(template.slots[2]).toMatchObject({
            role: 'neutral',
            tint: null,
            hueWidth: 360,
        });
        const at = (anchor: number, mirrored: boolean) =>
            templateConstraints(template, anchor, {
                mirrored,
                avoid: [hueArc(95, 135)],
            });
        for (const [anchor, mirrored] of [
            [0, false],
            [123, false],
            [200, true],
        ] as const) {
            expect(at(anchor, mirrored).slice(1)).toEqual([
                {
                    hues: [{ center: expect.closeTo(tint, 9), width: 60 }],
                    chroma: { min: 0, max: 0.08 },
                },
                { chroma: { min: 0, max: 0.08 } },
            ]);
        }
    });

    test('gives each color the same slot whatever the order of the colors, and turns the slots with them', () => {
        const random = seededRandom(27);
        const sets = [
            // a muted color between two groups: its reach from one's structural slot ends exactly where its
            // reach from the other's begins
            {
                colors: ['#f15193', '#6d5b53', '#86572a', '#9a6793'],
                nColors: 6,
                angle: 129.8537134565413,
            },
            ...Array.from({ length: 1500 }, (_, s) => ({
                colors: Array.from({ length: 1 + (s % 6) }, () =>
                    (s % 2
                        ? randomColor({ random })
                        : randomColor({ random, constraint: {} })
                    ).hex(),
                ),
                nColors: 1 + (s % 6) + Math.floor(random() * 3),
                angle: random() * 360,
            })),
        ];
        const same = (a: TemplateSlot, b: TemplateSlot) => {
            expect(a.hueWidth).toBeCloseTo(b.hueWidth, 6);
            expect(a.chroma.min!).toBeCloseTo(b.chroma.min!, 6);
            expect(a.chroma.max!).toBeCloseTo(b.chroma.max!, 6);
        };
        let compared = 0;
        for (const { colors, nColors, angle } of sets) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            // the extra slots go to the earlier of two colors of equal chroma (as vivid as sRGB allows, say),
            // which a turn can tip by a hair
            const chromas = analysis.picks
                .filter((pick) => pick.role !== 'neutral')
                .map((pick) => pick.chroma);
            if (
                nColors > colors.length &&
                chromas.some((c, i) =>
                    chromas.some((d, j) => j > i && Math.abs(c - d) < 1e-6),
                )
            ) {
                continue;
            }
            compared++;
            const template = relationshipTemplate(analysis, { nColors });
            // in another order: each color's own slot is the same
            const order = colors.map((_, i) => i);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [order[i], order[j]] = [order[j]!, order[i]!];
            }
            const shuffled = relationshipTemplate(
                analyzeTheme(
                    order.map((i) => colors[i]!),
                    { minBrightness: FLOOR },
                ),
                { nColors },
            );
            order.forEach((i, k) => {
                same(
                    shuffled.slots[shuffled.pickSlots![k]!]!,
                    template.slots[template.pickSlots![i]!]!,
                );
            });
            // every hue turned by the same angle: the same slots
            const turned = relationshipTemplate(
                analyzeTheme(
                    analysis.picks.map(({ hue, brightness, chroma }) =>
                        colorFromHue({
                            hue: (hue ?? 0) + angle,
                            brightness,
                            chroma: hue === null ? 0 : chroma,
                        }),
                    ),
                    { minBrightness: FLOOR },
                ),
                { nColors },
            );
            turned.slots.forEach((slot, i) => same(slot, template.slots[i]!));
        }
        expect(compared).toBeGreaterThan(1400);
    });

    test('is plain JSON', () => {
        for (const colors of [...Object.values(THEMES), []]) {
            const template = relationshipTemplate(
                analyzeTheme(colors, { minBrightness: FLOOR }),
                { nColors: 7 },
            );
            expect(JSON.parse(JSON.stringify(template))).toEqual(template);
        }
    });
});

describe('the layout for nColors', () => {
    test('gives each color a run, in input order: its own slot, then its extras, which copy it', () => {
        const analysis = analyzeTheme(['#ff0000', '#0000ff'], {
            minBrightness: FLOOR,
        });
        const template = relationshipTemplate(analysis, { nColors: 5 });
        // both are fully saturated (relative chroma 1): 3 extras shared 1.5 each, the tie to the earlier
        expect(template.slots.map((slot) => slot.pick)).toEqual([
            0, 0, 0, 1, 1,
        ]);
        expect(template.pickSlots).toEqual([0, 3]);
        const own = relationshipTemplate(analysis).slots;
        expect(template.slots.slice(0, 3)).toEqual([own[0], own[0], own[0]]);
        expect(template.slots.slice(3)).toEqual([own[1], own[1]]);
    });

    test('shares the extras by relative chroma, largest remainder first, and none to neutrals', () => {
        const vivid = colorFromHue({ hue: 30, brightness: 1, chroma: 0.9 });
        const muted = colorFromHue({ hue: 200, brightness: 1, chroma: 0.3 });
        const analysis = analyzeTheme([muted, '#808080', vivid]);
        // 5 extras: 0.3 : 0.9 → 1.25 and 3.75 → 1 and 4
        expect(
            relationshipTemplate(analysis, { nColors: 8 }).slots.map(
                (slot) => slot.pick,
            ),
        ).toEqual([0, 0, 1, 2, 2, 2, 2, 2]);
        expect(
            relationshipTemplate(analysis, { nColors: 8 }).pickSlots,
        ).toEqual([0, 2, 3]);
    });

    test('shares them evenly when every color is neutral', () => {
        const analysis = analyzeTheme(['#ffffff', '#808080', '#202020']);
        expect(
            relationshipTemplate(analysis, { nColors: 8 }).slots.map(
                (slot) => slot.pick,
            ),
        ).toEqual([0, 0, 0, 1, 1, 1, 2, 2]);
    });

    test('never lays out fewer slots than colors, and takes a whole number', () => {
        const analysis = analyzeTheme(THEMES.dusk!, { minBrightness: FLOOR });
        for (const nColors of [0, 3, -2, NaN, Infinity, 5.9]) {
            expect(
                relationshipTemplate(analysis, { nColors }).slots,
            ).toHaveLength(5);
        }
        expect(
            relationshipTemplate(analysis, { nColors: 7.9 }).slots,
        ).toHaveLength(7);
        expect(relationshipTemplate(analyzeTheme([])).slots).toEqual([]);
    });
});

describe('palettes filled around the picks', () => {
    test('keep the relationship of the concept themes and their picks: 100 %', () => {
        const random = seededRandom(2);
        let grown = 0;
        for (const colors of Object.values(THEMES)) {
            for (const n of [6, 8]) {
                for (let i = 0; i < 100; i++) {
                    const { analysis, colors: palette } = grow(
                        colors,
                        n,
                        random,
                    );
                    expect(keepsShape(palette, analysis)).toBe(true);
                    grown++;
                }
            }
            // one to three of each theme's colors, grown to 5
            for (let k = 1; k <= 3; k++) {
                for (let start = 0; start + k <= colors.length; start++) {
                    for (let i = 0; i < 20; i++) {
                        const picks = colors.slice(start, start + k);
                        const { analysis, colors: palette } = grow(
                            picks,
                            5,
                            random,
                        );
                        expect(keepsShape(palette, analysis)).toBe(true);
                        grown++;
                    }
                }
            }
        }
        for (const picks of Object.values(PICKS)) {
            for (let i = 0; i < 100; i++) {
                const { analysis, colors } = grow(picks, 5, random);
                expect(keepsShape(colors, analysis)).toBe(true);
                grown++;
            }
        }
        expect(grown).toBe(5 * (200 + 20 * (5 + 4 + 3)) + 800);
    }, 30_000);

    test('keep the relationship of random sets of 1–3 picks in at least 99.9 % of palettes', () => {
        // measured: 99.985 % of 20,000 (the same for picks drawn in HSV). Each miss is a group within a
        // degree or two of contrastFrom from another, whose center its extra slots move across it, weighing
        // one of its picks more than another, however narrow the slots.
        const random = seededRandom(3);
        const N = 6000;
        let kept = 0;
        for (let i = 0; i < N; i++) {
            const picks = Array.from({ length: 1 + (i % 3) }, () =>
                randomColor({ random, constraint: {} }).hex(),
            );
            const n = Math.max(picks.length, 3 + Math.floor(random() * 6));
            const { analysis, colors } = grow(picks, n, random);
            if (keepsShape(colors, analysis)) kept++;
        }
        expect(kept / N).toBeGreaterThanOrEqual(0.999);
    }, 30_000);

    test('meet the constraints of their slots, and keep the picks in their own', () => {
        const random = seededRandom(4);
        for (const picks of Object.values(PICKS)) {
            const { template, constraints, colors } = grow(picks, 6, random);
            colors.forEach((color, i) => {
                if (template.pickSlots!.includes(i)) return;
                expect(
                    meetsConstraint(color, constraints[i]!, {
                        minBrightness: FLOOR,
                    }),
                ).toBe(true);
            });
            template.pickSlots!.forEach((slot, j) => {
                expect(colors[slot]!.hex()).toBe(lifted(picks)[j]!.hex());
            });
        }
    });
});

describe('templateConstraints', () => {
    const analysis = analyzeTheme(THEMES.gold!, { minBrightness: FLOOR });
    const template = relationshipTemplate(analysis);

    test('centers each rotating slot on anchor + offset, or anchor − offset mirrored', () => {
        for (const [anchor, mirrored] of [
            [0, false],
            [250, false],
            [250, true],
            [-30, true],
        ] as const) {
            const constraints = templateConstraints(template, anchor, {
                mirrored,
            });
            constraints.forEach((constraint, i) => {
                const slot = template.slots[i]!;
                const center = anchor + (mirrored ? -1 : 1) * slot.offset!;
                expect(constraint).toEqual({
                    hues: [
                        {
                            center: expect.closeTo(
                                ((center % 360) + 360) % 360,
                                9,
                            ),
                            width: slot.hueWidth,
                        },
                    ],
                    chroma: slot.chroma,
                });
            });
        }
        // an anchor that is not a finite number counts as 0
        expect(templateConstraints(template, NaN)).toEqual(
            templateConstraints(template, 0),
        );
    });

    test('adds avoid to every rotating slot', () => {
        const avoid = [hueArc(95, 135)];
        for (const constraint of templateConstraints(template, 90, {
            avoid,
        })) {
            expect(constraint.avoid).toEqual(avoid);
        }
    });

    test('at the analysis anchor, are adjacentConstraints', () => {
        expect(adjacentConstraints(analysis)).toEqual(
            templateConstraints(template, analysis.anchor!),
        );
        expect(adjacentConstraints(analysis, { nColors: 7 })).toEqual(
            templateConstraints(
                relationshipTemplate(analysis, { nColors: 7 }),
                analysis.anchor!,
            ),
        );
        // every color of the theme lies in its own neighbourhood, as shown
        adjacentConstraints(analysis).forEach((constraint, i) => {
            expect(
                meetsConstraint(THEMES.gold![i]!, constraint, {
                    minBrightness: FLOOR,
                }),
            ).toBe(true);
        });
    });
});

describe('randomLike', () => {
    const dusk = analyzeTheme(THEMES.dusk!, { minBrightness: FLOOR });

    test('draws a palette in the same relationship, one color per slot, verified', () => {
        const random = seededRandom(5);
        for (const colors of [
            ...Object.values(THEMES),
            ...Object.values(PICKS),
        ]) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            for (let i = 0; i < 20; i++) {
                const result = randomLike(analysis, { random });
                expect(result.verified).toBe(true);
                expect(result.relationship).toBe(analysis.relationship);
                expect(result.colors).toHaveLength(colors.length);
                expect(keepsShape(result.colors, analysis)).toBe(true);
                result.colors.forEach((color) => {
                    expect(color.get('hsv.v')).toBeGreaterThanOrEqual(
                        FLOOR - 1e-9,
                    );
                });
            }
        }
    });

    test('lays out nColors for an analysis, with a base half-width of 8°', () => {
        const result = randomLike(dusk, {
            random: seededRandom(6),
            nColors: 7,
        });
        expect(result.colors).toHaveLength(7);
        const template = relationshipTemplate(dusk, {
            hueWidth: 8,
            nColors: 7,
        });
        expect(result.constraints).toEqual(
            templateConstraints(template, result.anchor, {
                mirrored: result.mirrored,
            }),
        );
    });

    test('draws the anchor (one call), then the mirroring (one call), then three calls per candidate', () => {
        const template = relationshipTemplate(dusk, { hueWidth: 8 });
        // no distance to keep: one candidate per slot
        const random = counting(seededRandom(7));
        randomLike(template, { random, deltaEThreshold: 0, attempts: 1 });
        expect(random.calls).toBe(2 + 3 * 5);
        const fixed = counting(seededRandom(7));
        randomLike(template, {
            random: fixed,
            deltaEThreshold: 0,
            attempts: 1,
            anchor: 40,
            mirror: false,
        });
        expect(fixed.calls).toBe(3 * 5);
    });

    test('is a pure function of its inputs and random', () => {
        const draw = () =>
            randomLike(dusk, { random: seededRandom(8), nColors: 6 });
        const a = draw();
        const b = draw();
        expect(a.colors.map((color) => color.rgb(false))).toEqual(
            b.colors.map((color) => color.rgb(false)),
        );
        expect({ ...a, colors: [] }).toEqual({ ...b, colors: [] });
    });

    test('places the anchor at a hue, or within the arcs given', () => {
        const random = seededRandom(9);
        expect(randomLike(dusk, { random, anchor: 400 }).anchor).toBe(40);
        const arcs = [hueArc(10, 40), hueArc(200, 210)];
        let inSecond = 0;
        for (let i = 0; i < 400; i++) {
            const { anchor } = randomLike(dusk, { random, anchor: arcs });
            const inFirst = anchor >= 10 && anchor <= 40;
            const second = anchor >= 200 && anchor <= 210;
            expect(inFirst || second).toBe(true);
            if (second) inSecond++;
        }
        // uniform over both arcs: 10° of 40
        expect(inSecond / 400).toBeGreaterThan(0.18);
        expect(inSecond / 400).toBeLessThan(0.32);
        const single = randomLike(dusk, {
            random,
            anchor: { center: 300, width: 0 },
        });
        expect(single.anchor).toBe(300);
    });

    test('mirrors half the time, or never with mirror false', () => {
        const random = seededRandom(10);
        let mirrored = 0;
        for (let i = 0; i < 400; i++) {
            if (randomLike(dusk, { random }).mirrored) mirrored++;
            expect(randomLike(dusk, { random, mirror: false }).mirrored).toBe(
                false,
            );
        }
        expect(mirrored / 400).toBeGreaterThan(0.42);
        expect(mirrored / 400).toBeLessThan(0.58);
    });

    test('never centers a rotating slot in avoid, and keeps every rotating color out of it', () => {
        const random = seededRandom(11);
        const avoid = [hueArc(95, 135)];
        const template = relationshipTemplate(dusk, { hueWidth: 8 });
        for (let i = 0; i < 300; i++) {
            const result = randomLike(template, {
                random,
                avoid,
                minBrightness: FLOOR,
            });
            template.slots.forEach((slot, s) => {
                const center = result.constraints[s]!.hues![0]!.center;
                expect(center > 95 && center < 135).toBe(false);
                const { hue } = measureColor(result.colors[s]!);
                expect(hue! > 95 + 1e-6 && hue! < 135 - 1e-6).toBe(false);
                expect(slot.offset).not.toBeNull();
            });
        }
        // a fixed anchor: the mirroring that keeps the slots out, where one does
        const fixed = randomLike(template, {
            random,
            avoid: [hueArc(330, 350)],
            anchor: 0,
        });
        for (const constraint of fixed.constraints) {
            const center = constraint.hues![0]!.center;
            expect(center > 330 && center < 350).toBe(false);
        }
    });

    test('keeps each color from the one before it, and the last from the first', () => {
        // wide slots, so the distance can always be kept
        const template = relationshipTemplate('spectrum', {
            nColors: 5,
            random: seededRandom(12),
        });
        const random = seededRandom(13);
        let lastNearFirst = 0;
        let plainLastNearFirst = 0;
        for (let i = 0; i < 300; i++) {
            const { colors, constraints } = randomLike(template, {
                random,
                minBrightness: 0.3,
            });
            for (let s = 1; s < colors.length; s++) {
                expect(
                    chroma.deltaE(colors[s - 1]!, colors[s]!, 1, 1, 1),
                ).toBeGreaterThanOrEqual(20);
            }
            if (chroma.deltaE(colors[4]!, colors[0]!, 1, 1, 1) < 20) {
                lastNearFirst++;
            }
            // the same slots, the last drawn only from the one before it
            const plain = randomColor({
                random,
                minBrightness: 0.3,
                constraint: constraints[4],
                awayFrom: [colors[3]!],
            });
            if (chroma.deltaE(plain, colors[0]!, 1, 1, 1) < 20) {
                plainLastNearFirst++;
            }
        }
        expect(lastNearFirst).toBe(0);
        expect(plainLastNearFirst).toBeGreaterThan(0);
    });

    test('draws a neutral source in place, verified', () => {
        const analysis = analyzeTheme(['#ffffff', '#948f88', '#202020']);
        expect(analysis.relationship).toBe('neutral');
        const random = counting(seededRandom(14));
        const result = randomLike(analysis, { random, nColors: 5 });
        expect(result).toMatchObject({
            anchor: 0,
            mirrored: false,
            relationship: 'neutral',
            verified: true,
        });
        expect(result.colors).toHaveLength(5);
        for (const color of result.colors) {
            expect(measureColor(color).chroma).toBeLessThanOrEqual(0.08 + 1e-9);
        }
        expect(analyzeTheme(result.colors).relationship).toBe('neutral');
        expect(randomLike(analyzeTheme([])).colors).toEqual([]);
    });

    test('returns the closest attempt, unverified, when none matches', () => {
        // a template that says spectrum, with one slot: no palette can match
        const template: RelationshipTemplate = {
            ...relationshipTemplate(analyzeTheme(['#ff0000'])),
            relationship: 'spectrum',
        };
        const random = counting(seededRandom(15));
        const result = randomLike(template, {
            random,
            attempts: 3,
            deltaEThreshold: 0,
        });
        expect(result.verified).toBe(false);
        expect(result.relationship).toBe('family');
        expect(random.calls).toBe(3 * (2 + 3));
    });

    test('verifies the number of groups as well as the relationship', () => {
        // one family group drawn, where the template counts three (as a family packed into less than 90°)
        const one = relationshipTemplate(analyzeTheme(['#ff0000']));
        const result = randomLike(
            { ...one, groups: [...one.groups, ...one.groups, ...one.groups] },
            { random: seededRandom(22), attempts: 2 },
        );
        expect(result.relationship).toBe('family');
        expect(result.verified).toBe(false);
    });

    test('verifies the palette rounded to 8 bits as well', () => {
        // random picks placed as a wild roll would be: rounded to 8 bits, a muted color's hue can move a few
        // degrees, which changes the relationship of about 1 in 130 of these palettes as drawn
        const random = seededRandom(26);
        let verified = 0;
        for (let s = 0; s < 1500; s++) {
            const picks = Array.from({ length: 1 + (s % 3) }, () =>
                randomColor({ random, constraint: {} }).hex(),
            );
            const analysis = analyzeTheme(picks, { minBrightness: FLOOR });
            if (analysis.anchor === null) continue;
            const anchor = analysis.anchor;
            const result = randomLike(analysis, {
                random,
                nColors: 5,
                anchor: [
                    hueArc(anchor + 30, anchor + 90),
                    hueArc(anchor - 90, anchor - 30),
                ],
                avoid: [hueArc(95, 135)],
            });
            if (!result.verified) continue;
            verified++;
            expect(keepsShape(result.colors, analysis)).toBe(true);
            expect(
                keepsShape(
                    result.colors.map((color) => color.hex()),
                    analysis,
                ),
            ).toBe(true);
        }
        expect(verified).toBeGreaterThan(1400);
    });

    test('draws the colors of the constraints it returns', () => {
        const random = seededRandom(16);
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            const result = randomLike(analysis, {
                random,
                avoid: [hueArc(95, 135)],
            });
            result.colors.forEach((color, i) => {
                expect(
                    meetsConstraint(color, result.constraints[i]!, {
                        minBrightness: FLOOR,
                    }),
                ).toBe(true);
            });
        }
    });
});

describe('relationshipTemplate, from a kind', () => {
    const kinds = [
        'family',
        'accent',
        'contrast',
        'bridge',
        'pair-accent',
        'triad',
        'spectrum',
    ] as const;

    test('lays out nColors slots in hue order from the anchor, of that kind', () => {
        const random = seededRandom(17);
        for (const kind of kinds) {
            for (let nColors = 4; nColors <= 8; nColors++) {
                const template = relationshipTemplate(kind, {
                    nColors,
                    random,
                });
                expect(template.relationship).toBe(kind);
                expect(template.slots).toHaveLength(nColors);
                expect(template.pickSlots).toBeNull();
                expect(template.groups[0]!.offset).toBe(0);
                for (const slot of template.slots) {
                    expect(slot).toMatchObject({
                        role: 'structural',
                        pick: null,
                        tint: null,
                        chroma: { min: 0.77, max: 1 },
                    });
                }
                // in hue order around the wheel, starting with the anchor's group
                const anchorSlots = template.slots.filter(
                    (slot) => slot.group === 0,
                ).length;
                expect(
                    template.slots
                        .slice(0, anchorSlots)
                        .every((slot) => slot.group === 0),
                ).toBe(true);
                const start = template.slots[0]!.offset!;
                const along = template.slots.map(
                    (slot) => (slot.offset! - start + 360) % 360,
                );
                expect([...along].sort((a, b) => a - b)).toEqual(along);
            }
        }
    });

    test('draws its geometry within the ranges', () => {
        const random = seededRandom(18);
        const distance = (t: RelationshipTemplate, g: number) =>
            hueDistance(t.groups[0]!.offset, t.groups[g]!.offset);
        for (let i = 0; i < 200; i++) {
            const family = relationshipTemplate('family', {
                nColors: 5,
                random,
            });
            expect(family.groups[0]!.span).toBeGreaterThanOrEqual(20);
            expect(family.groups[0]!.span).toBeLessThanOrEqual(40);
            const accent = relationshipTemplate('accent', {
                nColors: 3,
                random,
            });
            expect(distance(accent, 1)).toBeGreaterThanOrEqual(50);
            expect(distance(accent, 1)).toBeLessThanOrEqual(80);
            const contrast = relationshipTemplate('contrast', {
                nColors: 3,
                random,
            });
            expect(distance(contrast, 1)).toBeGreaterThanOrEqual(150);
            const bridge = relationshipTemplate('bridge', {
                nColors: 3,
                random,
            });
            expect(distance(bridge, 1)).toBeGreaterThanOrEqual(100);
            expect(distance(bridge, 1)).toBeLessThanOrEqual(140);
            const triad = relationshipTemplate('triad', {
                nColors: 3,
                random,
            });
            for (const g of [1, 2]) {
                expect(distance(triad, g)).toBeGreaterThanOrEqual(108);
                expect(distance(triad, g)).toBeLessThanOrEqual(132);
            }
        }
        const spectrum = relationshipTemplate('spectrum', {
            nColors: 6,
            random,
        });
        expect(spectrum.groups.map((group) => group.offset)).toEqual([
            0, 60, 120, 180, -120, -60,
        ]);
    });

    test('gives the anchor group the most slots, and drops the lightest groups when there are too few', () => {
        const random = seededRandom(19);
        const sizes = (t: RelationshipTemplate) =>
            t.groups.map(
                (_, g) => t.slots.filter((slot) => slot.group === g).length,
            );
        expect(
            sizes(relationshipTemplate('accent', { nColors: 5, random })),
        ).toEqual([3, 2]);
        expect(
            sizes(relationshipTemplate('triad', { nColors: 5, random })),
        ).toEqual([3, 1, 1]);
        expect(
            relationshipTemplate('triad', { nColors: 2, random }).relationship,
        ).toBe('contrast');
        expect(
            relationshipTemplate('pair-accent', { nColors: 2, random })
                .relationship,
        ).toBe('accent');
        expect(
            relationshipTemplate('spectrum', { nColors: 3, random })
                .relationship,
        ).toBe('triad');
        expect(
            relationshipTemplate('accent', { nColors: 1, random }).relationship,
        ).toBe('family');
    });

    test('adds tints: muted slots that follow the groups', () => {
        const random = seededRandom(20);
        for (let i = 0; i < 100; i++) {
            const template = relationshipTemplate('contrast', {
                nColors: 6,
                tints: 2,
                random,
            });
            const tints = template.slots.filter(
                (slot) => slot.role === 'muted',
            );
            expect(tints).toHaveLength(2);
            for (const tint of tints) {
                expect(tint.chroma).toEqual({ min: 0.3, max: 0.6 });
            }
            const result = randomLike(template, { random });
            expect(result.verified).toBe(true);
        }
        // never more tints than leave a slot for each group
        expect(
            relationshipTemplate('triad', {
                nColors: 4,
                tints: 3,
                random,
            }).slots.filter((slot) => slot.role === 'muted'),
        ).toHaveLength(1);
    });
});

describe('palettes drawn within the slots', () => {
    /** Draws each slot's color on its own, within its constraint, with no distance kept. */
    function within(constraints: ColorConstraint[], random: () => number) {
        return constraints.map((constraint) =>
            randomColor({ random, minBrightness: FLOOR, constraint }),
        );
    }

    test('keep the relationship of the concept themes, adjacent and placed elsewhere', () => {
        const random = seededRandom(21);
        for (const colors of Object.values(THEMES)) {
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            for (const hueWidth of [8, 12]) {
                const template = relationshipTemplate(analysis, {
                    hueWidth,
                    nColors: 7,
                });
                for (let i = 0; i < 100; i++) {
                    const constraints = templateConstraints(
                        template,
                        random() * 360,
                        { mirrored: random() < 0.5 },
                    );
                    const palette = within(constraints, random);
                    expect(keepsShape(palette, analysis)).toBe(true);
                    // rounded to 8 bits too
                    expect(
                        keepsShape(
                            palette.map((color) => color.hex()),
                            analysis,
                        ),
                    ).toBe(true);
                }
            }
        }
    });

    test('keep the relationship of random sets of colors, at the ends of their slots too: 99.95 % or more', () => {
        // one to five colors (drawn in OKLCH and in HSV), a slot each, adjacent and placed elsewhere.
        // Measured: none of the 32,000 palettes here changes. Of 313,000 palettes of one to six colors,
        // about 1 in 4,000 does, all from sets whose own colors sit within a degree of a threshold (0.2° from
        // contrastFrom, say), where a color's chroma kept inside its role's interval (see TemplateSlot.chroma)
        // already moves a group's center across.
        const random = seededRandom(25);
        let palettes = 0;
        let kept = 0;
        for (let s = 0; s < 1600; s++) {
            const colors = Array.from({ length: 1 + (s % 5) }, () =>
                (s % 2
                    ? randomColor({ random })
                    : randomColor({ random, constraint: {} })
                ).hex(),
            );
            const analysis = analyzeTheme(colors, { minBrightness: FLOOR });
            for (const hueWidth of [8, 12]) {
                const template = relationshipTemplate(analysis, { hueWidth });
                for (let i = 0; i < 10; i++) {
                    const constraints =
                        hueWidth === 12
                            ? templateConstraints(
                                  template,
                                  analysis.anchor ?? 0,
                              )
                            : templateConstraints(template, random() * 360, {
                                  mirrored: random() < 0.5,
                              });
                    const palette = constraints.map((constraint) =>
                        atCorner(constraint, random),
                    );
                    palettes++;
                    if (keepsShape(palette, analysis)) kept++;
                }
            }
        }
        expect(palettes).toBe(32_000);
        expect(kept / palettes).toBeGreaterThanOrEqual(0.9995);
    }, 30_000);
});
