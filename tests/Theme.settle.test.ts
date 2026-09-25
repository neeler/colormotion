import chroma from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { InterpolationMode, Theme } from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];
const EMERALD = ['#2b8f6b', '#9fe0c0', '#0f4f4a', '#3fb28a', '#123024'];

/**
 * Runs a transitionSpeed transition to its end and reports how many ticks it took and how far
 * (average CIEDE2000 over a sample of the scale colors) the colors jumped on the tick that ended it.
 */
function runTransition(
    from: string[],
    to: string[],
    mode: InterpolationMode,
    transitionSpeed: number,
    nSteps = 256,
) {
    // every fourth scale color: enough to measure the last jump without reading them all every tick
    const samples = Array.from({ length: nSteps / 4 }, (_, i) => i * 4);
    const theme = new Theme({ colors: from, mode, nSteps });
    theme.update({ colors: to, transitionSpeed });
    const target = theme.targetPalette!.scaleColors;
    let ticks = 0;
    let before = samples.map((i) => target[i]!);
    while (theme.isTransitioning) {
        before = samples.map((i) => theme.getColor(i));
        theme.tick(0);
        ticks++;
        // the longest transition here takes about 4,300 ticks
        if (ticks > 20_000) {
            throw new Error('transition did not end');
        }
    }
    const lastJump =
        before.reduce(
            (sum, color, k) =>
                sum + chroma.deltaE(target[samples[k]!]!, color, 1, 1, 1),
            0,
        ) / samples.length;
    return { ticks, lastJump };
}

// slow transitions run for thousands of ticks
describe('a transitionSpeed transition', { timeout: 60_000 }, () => {
    test('does not end while the distance holds steady far from the target', () => {
        // in OKLCH the distance from emerald night to dusk first rises, then holds for a tick;
        // this used to end the transition after 3 ticks (speed 0.1271) or 5 (0.05) with a 45 ΔE jump
        for (const speed of [0.05, 0.1271]) {
            const { ticks, lastJump } = runTransition(
                EMERALD,
                DUSK,
                'oklch',
                speed,
            );
            expect(ticks, `speed ${speed}`).toBeGreaterThan(300);
            expect(lastJump, `speed ${speed}`).toBeLessThan(0.5);
        }
    });

    test('does not end mid-transition when the distance holds steady', () => {
        // this pair used to end after 16 ticks in HSL, 40 ΔE short of its target
        const { ticks, lastJump } = runTransition(
            ['#8ccd86', '#2d1418', '#0f43ab', '#aa8ff9', '#066556'],
            ['#48d489', '#34f1f3', '#4484db', '#efaf91', '#cf507e'],
            'hsl',
            0.03,
        );
        expect(ticks).toBeGreaterThan(1000);
        expect(lastJump).toBeLessThan(0.5);
    });

    test('ends slow transitions with a jump too small to see', () => {
        // the per-tick change drops below 0.001 ΔE at about 0.01 / speed ΔE from the target,
        // which used to leave a ~1 ΔE jump at speed 0.01
        for (const mode of ['rgb', 'oklch'] as const) {
            const { lastJump } = runTransition(GOLD, DUSK, mode, 0.01, 64);
            expect(lastJump, mode).toBeLessThan(0.5);
        }
    });

    test('ends on the same tick as 3.5.0 at speeds of 0.02 and above', () => {
        // at these speeds the per-tick change falls below 0.001 ΔE within 0.5 ΔE of the target
        const before: [number, number][] = [
            [1, 77],
            [0.1, 558],
            [0.02, 1997],
        ];
        for (const [speed, ticks] of before) {
            expect(
                runTransition(GOLD, DUSK, 'rgb', speed).ticks,
                `speed ${speed}`,
            ).toBe(ticks);
        }
    });

    test('ends when the mode cannot reach the target colors', () => {
        // mixing toward a color with no hue keeps the other color's chroma or saturation (as chroma.mix
        // does): black in HCL and OKLCH, and in HSI white and pure reds, so the distance holds far above 0.5
        const cases: [InterpolationMode, string[]][] = [
            ['hsi', ['#ff0000', '#000000']],
            ['hsi', ['#ffffff']],
            ['hcl', ['#000000']],
            ['oklch', ['#000000']],
        ];
        for (const [mode, to] of cases) {
            const { ticks } = runTransition(['#0000ff'], to, mode, 0.1);
            expect(ticks, `${mode} to ${to}`).toBeLessThan(2000);
        }
    });

    test('still ends on the second tick at a speed that cannot move the colors', () => {
        // 1 - 5e-16 / 10 rounds to 1; 1 - 1e-15 / 10 does not
        for (const speed of [0, 1e-17, 5e-16]) {
            expect(runTransition(GOLD, DUSK, 'rgb', speed).ticks).toBe(2);
        }
        const theme = new Theme({ colors: GOLD, nSteps: 64 });
        theme.update({ colors: DUSK, transitionSpeed: 1e-15 });
        for (let k = 0; k < 10; k++) {
            theme.tick(0);
        }
        expect(theme.isTransitioning).toBe(true);
    });

    test('keeps moving at a very slow speed instead of snapping', () => {
        const theme = new Theme({ colors: GOLD, nSteps: 64 });
        theme.update({ colors: DUSK, transitionSpeed: 0.0001 });
        theme.tick(0);
        const first = theme.transitionDistance!;
        for (let k = 0; k < 100; k++) {
            theme.tick(0);
        }
        expect(theme.isTransitioning).toBe(true);
        expect(theme.transitionDistance!).toBeLessThan(first);
    });
});
