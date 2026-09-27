import chroma, { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { ColorPalette, InterpolationMode, InterpolationModes } from '../src';
import {
    mixCoords,
    mixScaleRgb,
    sampleScale,
    scaleCoords,
    toModeCoords,
} from '../src/interpolate';

function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Everything a chroma-js color holds: its channels and alpha, plus the clipping record chroma keeps
 * alongside them (whether a channel was out of range, and the values before clipping).
 * toEqual compares numbers with Object.is, so this is exact down to the sign of zero.
 */
function state(color: Color) {
    const rgba = (
        color as unknown as {
            _rgb: number[] & { _clipped: boolean; _unclipped: number[] };
        }
    )._rgb;
    return {
        rgba: [...rgba],
        clipped: rgba._clipped,
        unclipped: rgba._unclipped,
    };
}

const random = seeded(7);
const randomColors = Array.from({ length: 40 }, () =>
    chroma.rgb(random() * 255, random() * 255, random() * 255),
);
// grays have no hue; black and white take the special saturation rule in hue modes
const edgeColors = [
    '#000000',
    '#ffffff',
    '#808080',
    '#ff0000',
    '#00ffff',
    '#e8b450',
    '#1a0a2e',
].map((c) => chroma(c));
const colors = [...edgeColors, ...randomColors];
// beyond [0, 1] mixes extrapolate out of gamut, which exercises clipping
const fractions = [-0.5, 0, 0.001, 0.037, 0.5, 0.999, 1, 1.5];

/**
 * Where mixCoords departs from chroma.mix on purpose: mixing a color that has a hue toward a hue-less end
 * that chroma's mix never reaches, black in LCH, HCL and OKLCH (lightness exactly 0) and white in HSI
 * (intensity exactly 1).
 */
function departsFromChroma(a: Color, b: Color, mode: InterpolationMode) {
    const unreachable = (c: Color) =>
        mode === 'hsi'
            ? c.hsi()[2] === 1
            : mode === 'lch' || mode === 'hcl'
              ? c.hcl()[2] === 0
              : mode === 'oklch'
                ? c.oklch()[0] === 0
                : false;
    const hasHue = (c: Color) => !isNaN(toModeCoords(c, mode)[0]!);
    return (unreachable(a) && hasHue(b)) || (unreachable(b) && hasHue(a));
}

/** Every pair of test colors (each color with a few others), for the given mode. */
function pairs() {
    return colors.flatMap((a, i) =>
        [3, 11, 29].map(
            (k) => [a, colors[(i * 7 + k) % colors.length]!] as const,
        ),
    );
}

describe('mixCoords matches chroma.mix exactly', () => {
    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            for (const [a, b] of pairs()) {
                if (departsFromChroma(a, b, mode)) continue;
                const ca = toModeCoords(a, mode);
                const cb = toModeCoords(b, mode);
                for (const f of fractions) {
                    expect(state(mixCoords(ca, cb, f, mode))).toEqual(
                        state(chroma.mix(a, b, f, mode)),
                    );
                }
            }
        });
    }

    test('with alpha', () => {
        const a = chroma('#e8b450').alpha(0.3);
        const b = chroma('#1a0a2e').alpha(0.9);
        for (const mode of Object.values(InterpolationModes)) {
            const mixed = mixCoords(
                toModeCoords(a, mode),
                toModeCoords(b, mode),
                0.25,
                mode,
                a.alpha(),
                b.alpha(),
            );
            // except in OKLCH, where chroma mixes a translucent color's alpha as its hue (see toModeCoords):
            // there, the colors mix as chroma mixes the opaque ones, and alpha as it mixes alpha in any mode
            const expected =
                mode === 'oklch'
                    ? chroma
                          .mix(a.alpha(1), b.alpha(1), 0.25, mode)
                          .alpha(chroma.mix(a, b, 0.25, 'rgb').alpha())
                    : chroma.mix(a, b, 0.25, mode);
            expect(state(mixed), mode).toEqual(state(expected));
        }
    });
});

describe('mixScaleRgb matches mixCoords exactly', () => {
    // including translucent colors, whose alpha is not written
    const translucent = [
        chroma('#e8b450').alpha(0.3),
        chroma('#1a0a2e').alpha(0.9),
        chroma('#00ff00').alpha(0),
    ];
    const all = pairs().concat(
        translucent.flatMap((a) =>
            colors.slice(0, 12).map((b) => [a, b] as const),
        ),
    );

    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            const from = scaleCoords(
                all.map(([a]) => a),
                mode,
            );
            const to = scaleCoords(
                all.map(([, b]) => b),
                mode,
            );
            const out = new Float64Array(all.length * 3);
            for (const f of fractions) {
                mixScaleRgb(from, to, f, mode, out);
                // toEqual compares with Object.is: exact, down to the sign of zero
                expect([...out], `f = ${f}`).toEqual(
                    all.flatMap(([a, b]) =>
                        mixCoords(
                            toModeCoords(a, mode),
                            toModeCoords(b, mode),
                            f,
                            mode,
                            a.alpha(),
                            b.alpha(),
                        ).rgb(false),
                    ),
                );
            }
        });
    }
});

describe('scaleCoords', () => {
    test('holds the mode coordinates of every color', () => {
        for (const mode of Object.values(InterpolationModes)) {
            expect([...scaleCoords(colors, mode)], mode).toEqual(
                colors.flatMap((c) => toModeCoords(c, mode)),
            );
        }
    });

    test('converts a list once per space', () => {
        const list = colors.slice(0, 5);
        expect(scaleCoords(list, 'oklch')).toBe(scaleCoords(list, 'oklch'));
        // lrgb mixes rgb's coordinates, and lch hcl's
        expect(scaleCoords(list, 'lrgb')).toBe(scaleCoords(list, 'rgb'));
        expect(scaleCoords(list, 'lch')).toBe(scaleCoords(list, 'hcl'));
        expect(scaleCoords(list, 'lab')).not.toBe(scaleCoords(list, 'hcl'));
        // a list with the same colors is another list
        expect(scaleCoords(list.slice(), 'oklch')).not.toBe(
            scaleCoords(list, 'oklch'),
        );
    });
});

describe('mixCoords reaches both ends', () => {
    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            for (const [a, b] of pairs()) {
                const ca = toModeCoords(a, mode);
                const cb = toModeCoords(b, mode);
                const at = (f: number) => mixCoords(ca, cb, f, mode);
                // within round-trip error (white reads as L 1.000001 in OKLCH), far under anything
                // visible (1 ΔE); the misses this guards against were 5–70 ΔE
                const limit = 0.05;
                expect(chroma.deltaE(at(0), a), `${a.hex()} at 0`).toBeLessThan(
                    limit,
                );
                expect(chroma.deltaE(at(1), b), `${b.hex()} at 1`).toBeLessThan(
                    limit,
                );
            }
        });
    }

    test('fades chroma out toward black and white instead of keeping it', () => {
        const red = chroma('#ff0000');
        const black = chroma('#000000');
        // chroma.mix keeps red's full chroma toward black in OKLCH, and ends at a dark red (#100000)
        expect(
            chroma.deltaE(chroma.mix(red, black, 1, 'oklch'), black),
        ).toBeGreaterThan(5);
        const half = mixCoords(
            toModeCoords(red, 'oklch'),
            toModeCoords(black, 'oklch'),
            0.5,
            'oklch',
        );
        expect(half.oklch()[1]).toBeCloseTo(red.oklch()[1] / 2, 6);
        // toward white in HSI, blue used to stay blue
        const blue = chroma('#0000ff');
        const white = chroma('#ffffff');
        expect(
            chroma.deltaE(chroma.mix(blue, white, 1, 'hsi'), white),
        ).toBeGreaterThan(50);
        expect(
            chroma.deltaE(
                mixCoords(
                    toModeCoords(blue, 'hsi'),
                    toModeCoords(white, 'hsi'),
                    1,
                    'hsi',
                ),
                white,
            ),
        ).toBeLessThan(1e-6);
    });

    test('keeps the hue of saturated reds in HSI', () => {
        // halfway from red to black in HSI is (127.5, 1.4e-14, 0): chroma's arccosine sees 1.0000000000000002
        // and returns no hue, as for a gray
        const darkRed = chroma.mix('#ff0000', '#000000', 0.5, 'hsi');
        expect(darkRed.hsi()[0]).toBeNaN();
        expect(darkRed.hsi()[1]).toBe(1);
        expect(toModeCoords(darkRed, 'hsi')[0]).toBeCloseTo(0, 6);
        // so a mix toward it takes its hue, and gets there
        const blue = chroma('#0000ff');
        const mixed = mixCoords(
            toModeCoords(blue, 'hsi'),
            toModeCoords(darkRed, 'hsi'),
            1,
            'hsi',
        );
        expect(chroma.deltaE(mixed, darkRed)).toBeLessThan(1e-6);
        expect(
            chroma.deltaE(chroma.mix(blue, darkRed, 1, 'hsi'), darkRed),
        ).toBeGreaterThan(20);
    });

    test('keeps the hue of saturated cyans in HSI', () => {
        // the other side of the clamp: the arccosine sees -1.0000000000000002
        const darkCyan = chroma(180, 0.9, 0.0075, 'hsi');
        expect(darkCyan.hsi()[0]).toBeNaN();
        expect(toModeCoords(darkCyan, 'hsi')[0]).toBeCloseTo(180, 6);
    });

    test('still dims linearly toward black in HSI and HSL, as chroma.mix does', () => {
        // black looks the same at any saturation in HSI and HSL, so chroma's mix keeps the color's own and
        // just dims it: halfway from red is rgb(127.5, 0, 0), as in RGB
        const red = chroma('#ff0000');
        const black = chroma('#000000');
        for (const mode of ['hsi', 'hsl'] as const) {
            const half = mixCoords(
                toModeCoords(red, mode),
                toModeCoords(black, mode),
                0.5,
                mode,
            );
            expect(state(half), mode).toEqual(
                state(chroma.mix(red, black, 0.5, mode)),
            );
            const [r, g, b] = half.rgb(false);
            expect(r, mode).toBeCloseTo(127.5, 6);
            expect(g + b, mode).toBeCloseTo(0, 6);
        }
    });

    test('never gives NaN channels in HSV', () => {
        // a hue that lands a hair below 0 used to wrap to exactly 360, which chroma can't convert
        const stops = ColorPalette.normalizeColors(['#261d23', '#3b7f2a']);
        const expected = chromaScaleColors(stops, 'hsv', 37);
        expect(expected.some((c) => c.rgb(false).some(Number.isNaN))).toBe(
            true,
        );
        const sampled = sampleScale(stops, 'hsv', 37);
        expect(sampled.every((c) => c.rgb(false).every(Number.isFinite))).toBe(
            true,
        );
    });
});

describe('translucent colors mix as their opaque selves, with alpha on its own', () => {
    // equal and unequal alphas, and the ends: chroma's getters add alpha to the coordinates only below 1
    const alphas = [
        [0.5, 0.5],
        [0.3, 0.9],
        [0, 1],
        [1, 0.25],
    ] as const;

    test('toModeCoords reads three coordinates, never alpha', () => {
        for (const mode of Object.values(InterpolationModes)) {
            for (const color of colors) {
                const opaque = toModeCoords(color, mode);
                expect(opaque, `${mode}, ${color.hex()}`).toHaveLength(3);
                for (const alpha of [0, 0.5, 0.999]) {
                    expect(
                        toModeCoords(color.alpha(alpha), mode),
                        `${mode}, ${color.hex()} at alpha ${alpha}`,
                    ).toEqual(opaque);
                }
            }
        }
    });

    for (const mode of Object.values(InterpolationModes)) {
        test(`in mixCoords (${mode})`, () => {
            for (const [a, b] of pairs()) {
                const ca = toModeCoords(a, mode);
                const cb = toModeCoords(b, mode);
                for (const [alpha0, alpha1] of alphas) {
                    const ta = toModeCoords(a.alpha(alpha0), mode);
                    const tb = toModeCoords(b.alpha(alpha1), mode);
                    for (const f of fractions) {
                        expect(
                            state(mixCoords(ta, tb, f, mode, alpha0, alpha1)),
                            `${a.hex()} to ${b.hex()} at ${f}, alphas ${alpha0} and ${alpha1}`,
                        ).toEqual(
                            state(
                                mixCoords(ca, cb, f, mode).alpha(
                                    alpha0 + f * (alpha1 - alpha0),
                                ),
                            ),
                        );
                    }
                }
            }
        });
    }

    test('halfway from a translucent red to a translucent blue in oklch', () => {
        // chroma reverses a translucent color's oklch coordinates with the alpha on the end, [alpha, h, C, L],
        // and mixes alpha as the hue: its mix is still red, #ff000080
        const red = chroma('#ff000080');
        const blue = chroma('#0000ff80');
        expect(chroma.mix(red, blue, 0.5, 'oklch').hex()).toBe('#ff000080');
        const half = mixCoords(
            toModeCoords(red, 'oklch'),
            toModeCoords(blue, 'oklch'),
            0.5,
            'oklch',
            red.alpha(),
            blue.alpha(),
        );
        expect(half.hex()).toBe(
            chroma
                .mix('#ff0000', '#0000ff', 0.5, 'oklch')
                .alpha(red.alpha())
                .hex(),
        );
        expect(half.hex()).toBe('#ba00c280');
    });
});

/**
 * What ColorPalette sampled before sampleScale: every color of the chroma scale but the last.
 */
function chromaScaleColors(
    colors: Color[],
    mode: InterpolationMode,
    nSteps: number,
) {
    const scale = chroma.scale(colors).mode(mode).domain([0, nSteps]).out(null);
    scale.cache(false);
    const sampled = scale.colors(nSteps + 1, null);
    sampled.pop();
    return sampled;
}

/**
 * chromaScaleColors, except in OKLCH, where chroma mixes a translucent color's alpha as its hue (see
 * toModeCoords): there, the scale of the opaque colors, with the alphas chroma's scale gives in any mode,
 * and the stops themselves where a sample lands on one.
 */
function expectedScaleColors(
    stops: Color[],
    mode: InterpolationMode,
    nSteps: number,
) {
    if (mode !== 'oklch' || stops.every((stop) => stop.alpha() === 1)) {
        return chromaScaleColors(stops, mode, nSteps);
    }
    const opaque = stops.map((stop) => stop.alpha(1));
    const alphas = chromaScaleColors(stops, 'rgb', nSteps).map((c) =>
        c.alpha(),
    );
    return chromaScaleColors(opaque, mode, nSteps).map((color, i) => {
        const stop = opaque.indexOf(color);
        return stop >= 0 ? stops[stop]! : color.alpha(alphas[i]!);
    });
}

function expectSameScale(actual: Color[], expected: Color[], stops: Color[]) {
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
        const want = expected[i]!;
        expect(state(actual[i]!), `step ${i}`).toEqual(state(want));
        // on a stop, the scale returns the stop itself, and elsewhere a new color
        expect(stops.indexOf(actual[i]!), `step ${i}`).toBe(
            stops.indexOf(want),
        );
    }
}

const palettes = [
    ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'],
    // black and white, and a single color (a palette of one stop, repeated)
    ['#000000', '#ffffff'],
    ['#ff0000'],
    // a gray (no hue), a translucent color, and a saturated one that mixes out of gamut
    ['#808080', chroma('#ff00ff').alpha(0.5), '#00ff00', '#0000ff'],
    // the most colors a palette holds by default
    randomColors.slice(0, 8),
]
    .map((colors) => ColorPalette.normalizeColors(colors))
    // two distinct stops, without the loop back to the first
    .concat([[chroma('#e8b450'), chroma('#1a0a2e').alpha(0.4)]]);

describe('sampleScale matches chroma.scale exactly', () => {
    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            for (const stops of palettes) {
                // step counts that do and don't divide evenly among the stops
                for (const nSteps of [1, 2, 3, 7, 49, 100, 256]) {
                    expectSameScale(
                        sampleScale(stops, mode, nSteps),
                        expectedScaleColors(stops, mode, nSteps),
                        stops,
                    );
                }
            }
        });
    }

    test('at the default 2048 steps', () => {
        const stops = palettes[0]!;
        for (const mode of ['rgb', 'lab', 'oklch'] as const) {
            expectSameScale(
                sampleScale(stops, mode, 2048),
                chromaScaleColors(stops, mode, 2048),
                stops,
            );
        }
    });
});

describe('ColorPalette scale colors', () => {
    test('are the colors chroma.scale samples', () => {
        const palette = new ColorPalette({
            colors: ['#e8b450', '#7a1a2b', '#2b1a12'],
            mode: 'oklch',
            nSteps: 300,
        });
        expectSameScale(
            palette.scaleColors,
            chromaScaleColors(palette.colors, 'oklch', 300),
            palette.colors,
        );
    });

    test('match chroma.scale for a fractional step count', () => {
        // (1.3 + 1) - 1 !== 1.3, so chroma spaces these samples differently from step / nSteps
        const palette = new ColorPalette({
            colors: ['#e8b450', '#7a1a2b', '#2b1a12'],
            mode: 'lab',
            nSteps: 1.3,
        });
        expectSameScale(
            palette.scaleColors,
            chromaScaleColors(palette.colors, 'lab', 1.3),
            palette.colors,
        );
    });

    test('come from chroma.scale for a single normalized color', () => {
        const red = chroma('#ff0000');
        const palette = new ColorPalette({
            normalizedColors: [red],
            mode: 'hsl',
            nSteps: 16,
        });
        expectSameScale(
            palette.scaleColors,
            chromaScaleColors([red], 'hsl', 16),
            [red],
        );
    });

    test('match chroma.scale for a single opaque normalized color in oklch', () => {
        // sampled here as the two stops chroma.scale makes of it, including a color whose alpha
        // chroma.oklch leaves unset
        for (const color of [...colors, chroma.oklch(0.6, 0.15, 30)]) {
            for (const nSteps of [1, 7, 100.5]) {
                const palette = new ColorPalette({
                    normalizedColors: [color],
                    mode: 'oklch',
                    nSteps,
                });
                expectSameScale(
                    palette.scaleColors,
                    chromaScaleColors([color], 'oklch', nSteps),
                    [color],
                );
            }
        }
    });

    test('come from chroma.scale for modes outside InterpolationModes', () => {
        // untyped callers can pass modes chroma supports but InterpolationMode doesn't list ('hcg'),
        // or none at all (chroma.mix falls back to lrgb)
        for (const mode of ['hcg', undefined]) {
            const palette = new ColorPalette({
                colors: ['#e8b450', '#7a1a2b', '#2b1a12'],
                mode: mode as InterpolationMode,
                nSteps: 12,
            });
            expectSameScale(
                palette.scaleColors,
                chromaScaleColors(
                    palette.colors,
                    mode as InterpolationMode,
                    12,
                ),
                palette.colors,
            );
        }
    });

    test('of translucent colors are those of the opaque colors, with their alpha', () => {
        // a gray (no hue) and colors all around the wheel, at one alpha and at several
        const opaque = ['#e8b450', '#808080', '#1a0a2e', '#00ffff', '#ff0000'];
        const cases = [
            opaque.map((hex) => `${hex}80`),
            opaque.map(
                (hex, i) => `${hex}${['40', '80', 'ff', '00', 'cc'][i]}`,
            ),
        ];
        for (const mode of Object.values(InterpolationModes)) {
            const expected = new ColorPalette({
                colors: opaque,
                mode,
                nSteps: 60,
            });
            for (const colors of cases) {
                const palette = new ColorPalette({ colors, mode, nSteps: 60 });
                // the alphas as chroma mixes them, in a mode where alpha stays out of the coordinates
                const alphas = chromaScaleColors(palette.colors, 'rgb', 60).map(
                    (c) => c.alpha(),
                );
                palette.scaleColors.forEach((color, i) => {
                    expect(color.rgb(false), `${mode}, step ${i}`).toEqual(
                        expected.scaleColors[i]!.rgb(false),
                    );
                    expect(color.alpha(), `${mode}, step ${i}`).toBe(alphas[i]);
                });
            }
        }
    });

    test('of a single translucent normalized color are those of the opaque color, with its alpha', () => {
        // chroma.scale samples a single color as two stops, and in OKLCH its mix reads the alpha as the hue
        for (const mode of Object.values(InterpolationModes)) {
            for (const hex of ['#0000ff', '#808080', '#e8b450', '#000000']) {
                const translucent = chroma(`${hex}80`);
                const expected = new ColorPalette({
                    normalizedColors: [chroma(hex)],
                    mode,
                    nSteps: 16,
                });
                const palette = new ColorPalette({
                    normalizedColors: [translucent],
                    mode,
                    nSteps: 16,
                });
                palette.scaleColors.forEach((color, i) => {
                    expect(
                        color.rgb(false),
                        `${mode}, ${hex}, step ${i}`,
                    ).toEqual(expected.scaleColors[i]!.rgb(false));
                    expect(color.alpha(), `${mode}, ${hex}, step ${i}`).toBe(
                        translucent.alpha(),
                    );
                });
            }
        }
        // chroma.scale's translucent blue is red past the first step
        const blue = new ColorPalette({
            normalizedColors: [chroma('#0000ff80')],
            mode: 'oklch',
            nSteps: 6,
        });
        expect(blue.scaleColors.map((color) => color.hex())).toEqual(
            Array(6).fill('#0000ff80'),
        );
    });
});
