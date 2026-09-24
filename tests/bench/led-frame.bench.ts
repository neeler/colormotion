import { bench, describe } from 'vitest';
import { Theme } from '../../src';
import { DUSK, GOLD, inTransition } from './fixtures';

/**
 * The LED workload: every pixel asks the theme for its color every frame, with its own brightness,
 * then reads out RGB for the wire. Dumpy Fuego does this for 5,045 pixels; budget per frame is
 * ~16.7 ms at 60 fps, ~40 ms at 25 fps.
 */
function frame(theme: Theme, nPixels: number, out: Uint8Array) {
    for (let p = 0; p < nPixels; p++) {
        const brightness = 0.25 + (0.75 * ((p * 7919) % 101)) / 100;
        const [r, g, b] = theme.getColor(p * 3, { brightness }).rgb();
        out[p * 3] = r;
        out[p * 3 + 1] = g;
        out[p * 3 + 2] = b;
    }
    theme.tick();
}

describe('LED frame (getColor per pixel + tick)', () => {
    for (const nPixels of [1000, 5000]) {
        const out = new Uint8Array(nPixels * 3);
        const steady = new Theme({
            colors: GOLD,
            mode: 'oklch',
            brightnessMode: 'linear',
        });
        bench(`${nPixels} px, steady`, () => frame(steady, nPixels, out));

        const t = inTransition(() => {
            const theme = new Theme({
                colors: GOLD,
                mode: 'oklch',
                brightnessMode: 'linear',
            });
            theme.update({ colors: DUSK, transitionSpeed: 0.01 });
            return theme;
        });
        bench(
            `${nPixels} px, while transitioning`,
            () => frame(t.get() as Theme, nPixels, out),
            t.options,
        );
    }
});
