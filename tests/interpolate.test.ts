import chroma, { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { ColorPalette, InterpolationMode, InterpolationModes } from '../src';
import { mixCoords, sampleScale, toModeCoords } from '../src/interpolate';

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

describe('mixCoords matches chroma.mix exactly', () => {
    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            for (let i = 0; i < colors.length; i++) {
                const a = colors[i]!;
                const b = colors[(i * 7 + 3) % colors.length]!;
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
            expect(state(mixed)).toEqual(state(chroma.mix(a, b, 0.25, mode)));
        }
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
                        chromaScaleColors(stops, mode, nSteps),
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

    test('come from chroma.scale for a fractional step count', () => {
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
});
