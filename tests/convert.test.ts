import chroma, { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import {
    darkenRgb,
    darkenScale,
    hclToRgb,
    hsiToRgb,
    hslToRgb,
    hsvToRgb,
    isD65WhitePoint,
    labToRgb,
    oklabToRgb,
    oklchToRgb,
} from '../src/convert';

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

const random = seeded(11);
const between = (min: number, max: number) => min + random() * (max - min);

type Convert = (
    x: number,
    y: number,
    z: number,
    out: Float64Array,
    o: number,
) => void;

/**
 * Converts each triple with `convert` into one buffer, at an offset, and expects the channels chroma's
 * Color holds for it. toEqual compares with Object.is, so this is exact down to the sign of zero (and NaN
 * matches NaN).
 */
function expectSameChannels(
    convert: Convert,
    triples: number[][],
    chromaOf: (x: number, y: number, z: number) => Color,
) {
    const out = new Float64Array(triples.length * 3 + 1);
    triples.forEach(([x, y, z], i) => convert(x!, y!, z!, out, i * 3 + 1));
    const expected = triples.flatMap(([x, y, z]) =>
        chromaOf(x!, y!, z!).rgb(false),
    );
    expect([...out.subarray(1)]).toEqual(expected);
    // nothing written before the offset
    expect(out[0]).toBe(0);
}

const N = 3000;

describe('conversions match chroma-js exactly', () => {
    test('lab', () => {
        // beyond the sRGB gamut on every side, which exercises the clip
        const triples = Array.from({ length: N }, () => [
            between(-10, 110),
            between(-140, 140),
            between(-140, 140),
        ]);
        triples.push([0, 0, 0], [100, 0, 0], [8, 0, 0], [7.9, 0, 0]);
        expectSameChannels(labToRgb, triples, (L, a, b) =>
            chroma(L, a, b, 'lab'),
        );
    });

    test('oklab', () => {
        const triples = Array.from({ length: N }, () => [
            between(-0.1, 1.1),
            between(-0.45, 0.45),
            between(-0.45, 0.45),
        ]);
        triples.push([0, 0, 0], [1, 0, 0], [0, -0, -0]);
        expectSameChannels(oklabToRgb, triples, (L, a, b) =>
            chroma(L, a, b, 'oklab'),
        );
    });

    test('hcl', () => {
        const triples = Array.from({ length: N }, () => [
            random() < 0.1 ? NaN : between(-30, 400),
            between(0, 150),
            between(-5, 105),
        ]);
        expectSameChannels(hclToRgb, triples, (h, c, l) =>
            chroma(h, c, l, 'hcl'),
        );
    });

    test('oklch', () => {
        const triples = Array.from({ length: N }, () => [
            between(-0.05, 1.05),
            between(0, 0.45),
            random() < 0.1 ? NaN : between(-30, 400),
        ]);
        expectSameChannels(oklchToRgb, triples, (l, c, h) =>
            chroma(l, c, h, 'oklch'),
        );
    });

    test('hsl', () => {
        const triples = Array.from({ length: N }, () => [
            random() < 0.05 ? NaN : between(-30, 400),
            random() < 0.1 ? 0 : between(0, 1),
            random() < 0.1 ? Math.round(random()) : between(0, 1),
        ]);
        triples.push([0, 0, 0.5], [NaN, 0, 1], [120, 1, 0.5], [360, 1, 0.5]);
        expectSameChannels(hslToRgb, triples, (h, s, l) =>
            chroma(h, s, l, 'hsl'),
        );
    });

    test('hsv', () => {
        const triples = Array.from({ length: N }, () => [
            random() < 0.05 ? NaN : between(-30, 400),
            random() < 0.1 ? 0 : between(0, 1),
            between(0, 1),
        ]);
        // 360 and beyond wrap; a hue left outside [0, 360) gives chroma NaN channels
        triples.push([360, 1, 1], [720, 1, 1], [-1e-15, 1, 1], [NaN, 0.5, 1]);
        expectSameChannels(hsvToRgb, triples, (h, s, v) =>
            chroma(h, s, v, 'hsv'),
        );
    });

    test('hsi', () => {
        const triples = Array.from({ length: N }, () => [
            random() < 0.05 ? NaN : between(-30, 400),
            random() < 0.05 ? NaN : between(0, 1),
            between(0, 1),
        ]);
        expectSameChannels(hsiToRgb, triples, (h, s, i) =>
            chroma(h, s, i, 'hsi'),
        );
    });
});

describe('darkenRgb', () => {
    const colors = [
        '#000000',
        '#ffffff',
        '#808080',
        '#ff0000',
        '#0000ff',
        '#e8b450',
        '#1a0a2e',
    ]
        .map((c) => chroma(c))
        .concat(
            Array.from({ length: 300 }, () =>
                chroma.rgb(random() * 255, random() * 255, random() * 255),
            ),
        );
    const rgb = new Float64Array(colors.flatMap((c) => c.rgb(false)));

    test('matches color.darken exactly', () => {
        // the darken factors brightness maps to (3 at 0, 0 at 1), and a few beyond
        for (const amount of [0, 1e-12, 0.3, 1, 1.5, 3, -1, 5]) {
            const out = new Float64Array(rgb.length);
            for (let o = 0; o < rgb.length; o += 3) {
                darkenRgb(rgb, o, amount, out, o);
            }
            expect([...out], `amount ${amount}`).toEqual(
                colors.flatMap((c) => c.darken(amount).rgb(false)),
            );
        }
    });

    test('can darken in place, twice over', () => {
        const out = rgb.slice();
        for (let o = 0; o < out.length; o += 3) {
            darkenRgb(out, o, 1.2, out, o);
            darkenRgb(out, o, 0.7, out, o);
        }
        expect([...out]).toEqual(
            colors.flatMap((c) => c.darken(1.2).darken(0.7).rgb(false)),
        );
    });

    test('darkenScale matches color.darken exactly, from channels or Lab coordinates', () => {
        const lab = new Float64Array(colors.flatMap((c) => c.lab()));
        for (const amount of [0, 0.3, 1, 3, -1]) {
            const expected = colors.flatMap((c) => c.darken(amount).rgb(false));
            const fromRgb = new Float64Array(rgb.length);
            darkenScale(rgb, false, amount, fromRgb);
            expect([...fromRgb], `channels, amount ${amount}`).toEqual(
                expected,
            );
            const fromLab = new Float64Array(rgb.length);
            darkenScale(lab, true, amount, fromLab);
            expect([...fromLab], `Lab, amount ${amount}`).toEqual(expected);
        }
        // in place, from Lab and then from the channels that leaves
        const out = lab.slice();
        darkenScale(out, true, 1.2, out);
        darkenScale(out, false, 0.7, out);
        expect([...out]).toEqual(
            colors.flatMap((c) => c.darken(1.2).darken(0.7).rgb(false)),
        );
    });
});

describe('isD65WhitePoint', () => {
    test('follows chroma.setLabWhitePoint', () => {
        expect(isD65WhitePoint()).toBe(true);
        try {
            chroma.setLabWhitePoint('D50');
            expect(isD65WhitePoint()).toBe(false);
            chroma.setLabWhitePoint('D65');
            expect(isD65WhitePoint()).toBe(true);
        } finally {
            chroma.setLabWhitePoint('d65' as 'D65');
        }
        expect(isD65WhitePoint()).toBe(true);
    });
});
