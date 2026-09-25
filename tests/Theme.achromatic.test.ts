import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { ColorPalette, InterpolationMode, Theme } from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
// black gaps between colors: a common LED look
const GAPS = ['#000000', '#ff3b1f', '#000000', '#ffb000'];
const WHITE_GAPS = ['#ffffff', '#ff3b1f', '#ffffff', '#ffb000'];
// the ends chroma's mix never reached: black in LCH, HCL and OKLCH, white in HSI
const CASES: [InterpolationMode, string[]][] = [
    ['lch', GAPS],
    ['hcl', GAPS],
    ['oklch', GAPS],
    ['hsi', WHITE_GAPS],
];

/** The largest change of any channel of any scale color between two readings, in 0–255 units. */
function largestChange(before: number[][], after: number[][]) {
    return before.reduce(
        (max, rgb, i) =>
            Math.max(max, ...rgb.map((v, c) => Math.abs(v - after[i]![c]!))),
        0,
    );
}

function read(theme: Theme, nSteps: number) {
    return Array.from({ length: nSteps }, (_, i) =>
        theme.getColor(i).rgb(false),
    );
}

describe('transitions toward black and white', () => {
    for (const [mode, gaps] of CASES) {
        test(`end without a pop (${mode})`, () => {
            const nSteps = 64;
            const theme = new Theme({ colors: GOLD, mode, nSteps });
            theme.update({ colors: gaps, transitionDuration: 120 });
            let before = read(theme, nSteps);
            let largest = 0;
            let last = 0;
            while (theme.isTransitioning) {
                theme.tick(0);
                const after = read(theme, nSteps);
                last = largestChange(before, after);
                largest = Math.max(largest, last);
                before = after;
            }
            // smoothstep lands at rest: the last tick moves next to nothing (it used to snap from a dark red)
            expect(last).toBeLessThan(0.5);
            expect(largest).toBeLessThan(10);
        });

        test(`settle by distance, not the completion floor (${mode})`, () => {
            const theme = new Theme({ colors: GOLD, mode, nSteps: 64 });
            theme.update({ colors: gaps, transitionSpeed: 0.1 });
            let ticks = 0;
            while (theme.isTransitioning && ticks < 5000) {
                theme.tick(0);
                ticks++;
            }
            // the 99.9999 % floor would take about 1,380 ticks at this speed
            expect(ticks).toBeLessThan(1000);
        });
    }
});

describe('palette scales', () => {
    for (const [mode, gaps] of CASES) {
        for (const nSteps of [96, 96.5]) {
            test(`reach a ${gaps[0] === '#000000' ? 'black' : 'white'} stop smoothly (${mode}, ${nSteps} steps)`, () => {
                const scale = new ColorPalette({
                    colors: ['#ff3b1f', gaps[0]!, '#ffb000'],
                    mode,
                    nSteps,
                }).scaleColors;
                const steps = scale.map((c, i) =>
                    chroma.deltaE(c, scale[(i + 1) % scale.length]!),
                );
                const sorted = [...steps].sort((a, b) => a - b);
                const median = sorted[sorted.length >> 1]!;
                // no step onto (or off) the stop stands out from its neighbors (chroma's: 25-100x the median)
                expect(Math.max(...steps)).toBeLessThan(median * 6);
            });
        }
    }
});
