import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { InterpolationModes } from '../src';
import { mixCoords, toModeCoords } from '../src/interpolate';

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
const fractions = [0, 0.001, 0.037, 0.5, 0.999, 1];

describe('mixCoords matches chroma.mix exactly', () => {
    for (const mode of Object.values(InterpolationModes)) {
        test(mode, () => {
            for (let i = 0; i < colors.length; i++) {
                const a = colors[i]!;
                const b = colors[(i * 7 + 3) % colors.length]!;
                const ca = toModeCoords(a, mode);
                const cb = toModeCoords(b, mode);
                for (const f of fractions) {
                    expect(mixCoords(ca, cb, f, mode).rgba(false)).toEqual(
                        chroma.mix(a, b, f, mode).rgba(false),
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
            expect(mixed.rgba(false)).toEqual(
                chroma.mix(a, b, 0.25, mode).rgba(false),
            );
        }
    });
});
