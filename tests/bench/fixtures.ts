import type { InterpolationMode } from '../../src';

/** mulberry32: a seeded random so every run benchmarks the same palettes. */
export function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Five-color palettes, as an LED piece would use them. */
export const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
export const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];

/** 256: a lookup-table size; 2048: the default. */
export const STEP_COUNTS = [256, 2048] as const;

/**
 * Options for benchmarking a transition in progress. `setup` runs once per benchmark (not per iteration),
 * so a fixed iteration count keeps the transition from finishing mid-run: at transitionSpeed 0.01 a
 * GOLD → DUSK transition takes thousands of ticks. `teardown` fails the run if it finished anyway,
 * since the rest would measure idle ticks.
 */
export function inTransition(start: () => { targetPalette?: unknown }) {
    let current: { targetPalette?: unknown } | undefined;
    return {
        options: {
            time: 0,
            iterations: 300,
            warmupTime: 0,
            warmupIterations: 10,
            setup: () => {
                current = start();
            },
            teardown: () => {
                if (!current?.targetPalette) {
                    throw new Error(
                        'the transition finished during the benchmark',
                    );
                }
            },
        },
        get: () => current!,
    };
}

/** The default, a common perceptual mode, and the newest (and most expensive) mode. */
export const MODES: InterpolationMode[] = ['rgb', 'lab', 'oklch'];
