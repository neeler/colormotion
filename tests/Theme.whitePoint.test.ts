import chroma from 'chroma-js';
import { afterEach, describe, expect, test } from 'vitest';
import {
    ColorPalette,
    ColorUpdateConfig,
    InterpolationMode,
    Theme,
} from '../src';

const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];
const DUSK = ['#6b2fa0', '#ff7a1a', '#3a1660', '#c0409a', '#1a0a2e'];
const JADE = ['#0f5c4a', '#8fd6b4', '#1a2e2a'];
const N_STEPS = 64;

/** The modes whose coordinates chroma-js reads through its Lab white point (OKLab too, in chroma-js 3). */
const LAB_MODES: InterpolationMode[] = ['lab', 'lch', 'hcl', 'oklab', 'oklch'];
const OTHER_MODES: InterpolationMode[] = ['rgb', 'lrgb', 'hsl', 'hsv', 'hsi'];

/** Both kinds of transition, slow enough to be midway after a few ticks. */
const TRANSITIONS: Record<string, ColorUpdateConfig> = {
    transitionDuration: { transitionDuration: 30 },
    transitionSpeed: { transitionSpeed: 0.5 },
};

/** chroma's own name for its default white point: getLabWhitePoint() returns it until it is changed. */
const DEFAULT_WHITE_POINT = 'd65' as 'D65';

afterEach(() => {
    chroma.setLabWhitePoint(DEFAULT_WHITE_POINT);
});

/** Every color the theme shows now, unrounded. */
function colorsOf(theme: Theme) {
    return Array.from({ length: N_STEPS }, (_, i) =>
        theme.getColor(i).rgba(false),
    );
}

/** A theme partway through a transition from GOLD to DUSK, its palettes built under the current white point. */
function midTransition(mode: InterpolationMode, config: ColorUpdateConfig) {
    const theme = new Theme({ colors: GOLD, mode, nSteps: N_STEPS });
    theme.update({ colors: DUSK, ...config });
    return theme;
}

function tick(ticks: number, ...themes: Theme[]) {
    for (let t = 0; t < ticks; t++) {
        for (const theme of themes) {
            theme.tick();
        }
    }
}

test('chroma starts on its default white point', () => {
    expect(chroma.getLabWhitePoint()).toBe(DEFAULT_WHITE_POINT);
});

describe.each(Object.entries(TRANSITIONS))(
    'during a %s transition',
    (_, config) => {
        test.each(LAB_MODES)(
            'getColor mixes %s under the white point set now',
            (mode) => {
                // theme reads every color under D65; underD50 ticks and reads only under D50; underD65 never
                // leaves D65. All three hold the same palettes, built under D65.
                const theme = midTransition(mode, config);
                const underD50 = midTransition(mode, config);
                const underD65 = midTransition(mode, config);
                tick(4, theme, underD65);
                const d65 = colorsOf(theme);

                chroma.setLabWhitePoint('D50');
                tick(4, underD50);
                const d50 = colorsOf(theme);
                expect(d50).toEqual(colorsOf(underD50));
                expect(d50).not.toEqual(d65);

                // and on the next tick
                tick(1, theme, underD50);
                expect(colorsOf(theme)).toEqual(colorsOf(underD50));

                // back on D65 (by its other name), the colors are the ones a theme that never left it shows
                chroma.setLabWhitePoint('D65');
                tick(1, underD65);
                expect(colorsOf(theme)).toEqual(colorsOf(underD65));
                chroma.setLabWhitePoint(DEFAULT_WHITE_POINT);
                tick(1, theme, underD65);
                expect(colorsOf(theme)).toEqual(colorsOf(underD65));
            },
        );

        test.each(OTHER_MODES)(
            'the white point leaves %s mixing as it is',
            (mode) => {
                const theme = midTransition(mode, config);
                tick(4, theme);
                const d65 = colorsOf(theme);
                chroma.setLabWhitePoint('D50');
                expect(colorsOf(theme)).toEqual(d65);
            },
        );

        test('a new target starts from the colors mixed under the white point set now', () => {
            const theme = midTransition('lab', config);
            const fresh = midTransition('lab', config);
            tick(3, theme, fresh);
            // under D65, and cached for this tick
            colorsOf(theme);

            chroma.setLabWhitePoint('D50');
            for (const t of [theme, fresh]) {
                t.update({ colors: JADE, transitionDuration: 10 });
            }
            tick(2, theme, fresh);
            expect(colorsOf(theme)).toEqual(colorsOf(fresh));
        });
    },
);

// rgb too: its colors don't depend on the white point, but CIEDE2000 compares them in Lab
test.each<InterpolationMode>(['oklch', 'rgb'])(
    'transitionDistance in %s is measured again when the white point changes within a tick',
    (mode) => {
        const theme = midTransition(mode, { transitionDuration: 30 });
        const fresh = midTransition(mode, { transitionDuration: 30 });
        tick(4, theme, fresh);
        const d65 = theme.transitionDistance;

        chroma.setLabWhitePoint('D50');
        const d50 = theme.transitionDistance;
        expect(d50).toBe(fresh.transitionDistance);
        expect(d50).not.toBe(d65);

        chroma.setLabWhitePoint(DEFAULT_WHITE_POINT);
        expect(theme.transitionDistance).toBe(d65);
    },
);

describe('palettes', () => {
    test('keep the scale colors they were built with', () => {
        const palette = new ColorPalette({
            colors: DUSK,
            mode: 'lab',
            nSteps: N_STEPS,
        });
        const theme = new Theme({ palette, nSteps: N_STEPS });
        const d65 = palette.scaleColors.map((c) => c.rgba(false));
        const themeD65 = colorsOf(theme);

        chroma.setLabWhitePoint('D50');
        expect(palette.scaleColors.map((c) => c.rgba(false))).toEqual(d65);
        expect(colorsOf(theme)).toEqual(themeD65);
        // a palette built now mixes under D50
        const d50 = new ColorPalette({
            colors: DUSK,
            mode: 'lab',
            nSteps: N_STEPS,
        });
        expect(d50.scaleColors.map((c) => c.rgba(false))).not.toEqual(d65);
    });

    test("a theme's copy of an assigned palette is made again under a new white point", () => {
        // a different nSteps, so the theme assigns a copy with its own
        const palette = new ColorPalette({
            colors: DUSK,
            mode: 'lab',
            nSteps: 16,
        });
        const theme = new Theme({ colors: GOLD, mode: 'lab', nSteps: N_STEPS });
        theme.palette = palette;
        const d65 = theme.palette;
        theme.palette = new ColorPalette({
            colors: JADE,
            mode: 'lab',
            nSteps: N_STEPS,
        });
        // the same copy while the white point stays
        theme.palette = palette;
        expect(theme.palette).toBe(d65);
        theme.palette = new ColorPalette({
            colors: JADE,
            mode: 'lab',
            nSteps: N_STEPS,
        });

        chroma.setLabWhitePoint('D50');
        theme.palette = palette;
        const fresh = new Theme({ colors: GOLD, mode: 'lab', nSteps: N_STEPS });
        fresh.palette = palette;
        expect(theme.palette).not.toBe(d65);
        expect(colorsOf(theme)).toEqual(colorsOf(fresh));
    });
});
