import { FRAME_RATE, getSettings } from '~/components/playground/settings';
import { tickTheme } from '~/components/playground/wheel';
import { Sketch } from '~/components/sketches/lib';
import { getTheme } from '~/components/theme/theme';
import { MovingObject } from '~/lib/MovingObject';

/**
 * Target distance between LED centers, in canvas pixels.
 */
const LED_PITCH = 16;

/**
 * Target distance between the strip's runs, in canvas pixels.
 */
const RUN_GAP = 64;

/**
 * One LED strip laid across the canvas in runs that snake back and forth,
 * with LED i set to theme.getColor(i * pixelSpacing) every frame: the way
 * colormotion drives pixels.
 */
export const ledStripSketch = new Sketch({
    state: () => {},
    movingState: () => new MovingObject({}),
    setup: (p5) => {
        p5.frameRate(FRAME_RATE);
        p5.background(0);
    },
    draw: (p5) => {
        const theme = getTheme();
        const { pixelSpacing } = getSettings();

        const nRuns = Math.max(2, Math.floor(p5.height / RUN_GAP));
        const runGap = p5.height / nRuns;
        // room at both ends for the bends between runs
        const margin = runGap / 2 + LED_PITCH / 2;
        const runLength = p5.width - 2 * margin;
        const nPerRun = Math.max(2, Math.floor(runLength / LED_PITCH) + 1);
        const pitch = runLength / (nPerRun - 1);
        const ledSize = Math.min(pitch, runGap) * 0.4;

        const leds: { x: number; y: number; rgb: number[] }[] = [];
        for (let run = 0; run < nRuns; run++) {
            const y = runGap * (run + 0.5);
            for (let k = 0; k < nPerRun; k++) {
                const i = run * nPerRun + k;
                leds.push({
                    x:
                        run % 2 === 0
                            ? margin + k * pitch
                            : p5.width - margin - k * pitch,
                    y,
                    rgb: theme.getColor(i * pixelSpacing).rgb(),
                });
            }
        }

        p5.background(0);

        // The strip: runs joined by bends at alternating ends
        p5.noFill();
        p5.stroke(22);
        p5.strokeWeight(pitch * 0.8);
        for (let run = 0; run < nRuns; run++) {
            const y = runGap * (run + 0.5);
            p5.line(margin, y, p5.width - margin, y);
            if (run < nRuns - 1) {
                const bendsRight = run % 2 === 0;
                p5.arc(
                    bendsRight ? p5.width - margin : margin,
                    y + runGap / 2,
                    runGap,
                    runGap,
                    bendsRight ? -p5.HALF_PI : p5.HALF_PI,
                    bendsRight ? p5.HALF_PI : p5.PI + p5.HALF_PI,
                );
            }
        }

        // Light spilling onto the strip and its neighbors
        p5.noStroke();
        p5.blendMode(p5.ADD);
        for (const { x, y, rgb } of leds) {
            const [r, g, b] = rgb;
            p5.fill(r, g, b, 36);
            p5.circle(x, y, pitch * 2.4);
            p5.fill(r, g, b, 80);
            p5.circle(x, y, pitch * 1.1);
        }
        p5.blendMode(p5.BLEND);

        // The LEDs
        p5.rectMode(p5.CENTER);
        for (const { x, y, rgb } of leds) {
            const [r, g, b] = rgb;
            p5.fill(r, g, b);
            p5.square(x, y, ledSize, ledSize * 0.25);
        }

        tickTheme();
    },
});
