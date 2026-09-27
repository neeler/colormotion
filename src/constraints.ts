import chroma, { Color } from 'chroma-js';
import {
    ColorInput,
    DEFAULT_DELTA_E_THRESHOLD,
    RandomFunction,
} from './ColorPalette';
import { drawAwayFrom } from './draw';
import { measureColor } from './gamut';
import { allowedHues, chromaBounds, distanceToHues } from './hueArcs';
import { safeMod } from './safeMod';

/**
 * An arc of OKLCH hue (as measureColor measures it), centered on a hue. It wraps through 360.
 */
export interface HueRange {
    /**
     * The hue in the middle of the arc, in degrees. Any finite number, wrapped. A center that is not a finite
     * number makes the range ignored, unless it covers every hue.
     */
    center: number;
    /**
     * The full width of the arc, in degrees: center ± width / 2. 0 is the one hue; 360 or more (Infinity
     * included) is every hue. A negative width counts as 0, and NaN makes the range ignored.
     */
    width: number;
}

/**
 * The arc of hue that runs from one hue up to another, increasing and wrapping through 360:
 * hueArc(330, 30) is { center: 0, width: 60 }, and hueArc(30, 330) is { center: 180, width: 300 }. From a
 * hue to itself is that one hue; a span of 360 or more is every hue.
 */
export function hueArc(from: number, to: number): HueRange {
    const span = to - from;
    if (span >= 360) {
        return {
            center: Number.isFinite(from) ? safeMod(from + 180, 360) : 0,
            width: 360,
        };
    }
    if (!Number.isFinite(span)) {
        // NaN, or a span of -Infinity: a range that is ignored
        return { center: NaN, width: NaN };
    }
    const width = safeMod(span, 360);
    return { center: safeMod(from + width / 2, 360), width };
}

/**
 * Bounds on relative chroma (see ColorMeasure.chroma): fractions of the most chroma sRGB allows at a color's
 * hue and brightness, so every value within them is a color at every hue and brightness. 0 is grey and 1 is
 * as saturated as sRGB allows.
 */
export interface ChromaRange {
    /** The lowest relative chroma. Defaults to 0; clamped to 0–1; NaN counts as not given. */
    min?: number;
    /** The highest relative chroma. Defaults to 1; clamped to 0–1; NaN counts as not given. A max below min swaps with it. */
    max?: number;
}

/**
 * Limits on the OKLCH hue and relative chroma of a random color. Brightness is set by minBrightness, as for
 * any random color. A color drawn within a constraint always meets it: no draw is rejected.
 */
export interface ColorConstraint {
    /** The hues allowed: the union of the arcs. Left out or empty (or with every range ignored): every hue. */
    hues?: readonly HueRange[];
    /**
     * Hues taken out of those allowed. Ignored when they would leave no hue, so a color can always be drawn.
     */
    avoid?: readonly HueRange[];
    /** The relative chroma allowed. Left out: from 0 to 1. */
    chroma?: ChromaRange;
}

/**
 * Constraints on the colors of a random palette: one for every color, or a list with one for each position
 * in the palette, in order (a missing entry, or an entry past the end, counts as {}: any color, drawn in
 * OKLCH).
 */
export type ColorConstraints =
    | ColorConstraint
    | readonly (ColorConstraint | undefined)[];

/**
 * Options for randomColor.
 */
export interface RandomColorOptions {
    /**
     * Random number generator. Defaults to Math.random. Supply a seeded generator for reproducible colors.
     */
    random?: RandomFunction;
    /** The lowest brightness (HSV value) the color can have, from 0 to 1. Defaults to 0. */
    minBrightness?: number;
    /**
     * Limits on the color's OKLCH hue and relative chroma. Given (even {}), the color is drawn in OKLCH:
     * brightness uniform from minBrightness to 1, hue uniform over the hues allowed, relative chroma uniform
     * within its range. Left out, it is drawn in HSV (hue, saturation, and value from minBrightness to 1), as
     * every random method drew colors in 4.0, so a seeded random draws the colors it drew then.
     */
    constraint?: ColorConstraint;
    /**
     * Colors to keep deltaEThreshold (CIEDE2000) from: candidates are drawn until one is at least that far from
     * every one of them, up to 100 candidates; if none is, the one furthest from its nearest is used. The
     * constraint always holds; the distance is best effort.
     */
    awayFrom?: readonly ColorInput[];
    /** The distance to keep from awayFrom. Defaults to DEFAULT_DELTA_E_THRESHOLD (20). */
    deltaEThreshold?: number;
}

/**
 * Draws a random color, at full precision (not rounded to 8 bits).
 *
 * Each candidate takes three calls to random, in the order the random methods make them: brightness, hue
 * and chroma (saturation, without a constraint). A seeded random gives the same colors every time.
 *
 * Uniform HSV hue, as drawn without a constraint, favors some OKLCH hues over others: about 22 % of full
 * saturation draws land in the greens from 120° to 150°, and about 4 % in each 30° of gold or cyan. With a
 * constraint (even {}), hue is uniform in OKLCH, and a chroma range can keep out the greys and pastels that
 * uniform saturation draws.
 */
export function randomColor({
    random = Math.random,
    minBrightness = 0,
    constraint,
    awayFrom = [],
    deltaEThreshold = DEFAULT_DELTA_E_THRESHOLD,
}: RandomColorOptions = {}): Color {
    return drawAwayFrom(
        awayFrom.map((color) => chroma(color)),
        { random, minBrightness, deltaEThreshold, constraint },
    );
}

/**
 * Whether a color meets a constraint: its relative chroma within the chroma range and its OKLCH hue on the
 * hues allowed (a color with no hue, such as grey, passes the hue check). The same hues are allowed as when
 * drawing: an avoid that would leave no hue is ignored here too.
 *
 * With minBrightness, the color is measured as lifted to it (see measureColor).
 *
 * tolerance is the slack at each bound, in relative chroma: defaults to 0.005, enough for a color given at
 * full precision. A hue counts as allowed if turning it onto the allowed hues would move the color by no more
 * than that much relative chroma, so the slack in hue widens as chroma falls (0.29° at full chroma, 2.9° at
 * 0.1), as the hue of a less saturated color is less certain. Colors rounded to 8 bits (hex) can need more,
 * most of all dark or unsaturated ones.
 */
export function meetsConstraint(
    color: ColorInput,
    constraint: ColorConstraint,
    {
        minBrightness,
        tolerance = 0.005,
    }: { minBrightness?: number; tolerance?: number } = {},
): boolean {
    const measure = measureColor(color, { minBrightness });
    const [min, max] = chromaBounds(constraint.chroma);
    if (measure.chroma < min - tolerance || measure.chroma > max + tolerance) {
        return false;
    }
    if (measure.hue === null) {
        return true;
    }
    const slack =
        measure.chroma > 0
            ? Math.min(180, (tolerance / measure.chroma) * (180 / Math.PI))
            : 180;
    return distanceToHues(allowedHues(constraint), measure.hue) <= slack;
}
