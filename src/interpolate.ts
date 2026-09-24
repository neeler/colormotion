import chroma, { Color } from 'chroma-js';
import { InterpolationMode } from './InterpolationMode';
import { clamp } from './clamp';

/**
 * A color's coordinates in the space an interpolation mode mixes in, exactly as chroma-js reads them
 * (including any trailing alpha chroma returns). Converting once and reusing the coordinates is what
 * makes repeated mixing cheap: chroma.mix converts both colors on every call.
 */
export type ModeCoords = number[];

/**
 * The coordinates chroma.mix(color, ·, f, mode) would read from `color`.
 */
export function toModeCoords(
    color: Color,
    mode: InterpolationMode,
): ModeCoords {
    switch (mode) {
        case 'rgb':
        case 'lrgb':
            return color.rgb(false);
        case 'lab':
            return color.lab();
        case 'oklab':
            return color.oklab();
        case 'hsl':
            return color.hsl();
        case 'hsv':
            return color.hsv();
        case 'hsi':
            return color.hsi();
        case 'lch':
        case 'hcl':
            return color.hcl();
        case 'oklch':
            return color.oklch().reverse();
    }
}

/**
 * Mixes two colors given their mode coordinates: the same result as
 * chroma.mix(color0, color1, f, mode), without converting either color.
 * Mirrors the arithmetic of chroma-js 3's interpolators (src/interpolator/*.js) expression for
 * expression and builds the same Color chroma.mix returns, so results are identical, not just close.
 */
export function mixCoords(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: InterpolationMode,
    alpha0 = 1,
    alpha1 = 1,
): Color {
    const alpha = alpha0 + f * (alpha1 - alpha0);
    switch (mode) {
        case 'rgb':
            return rgbWithAlpha(
                xyz0[0]! + f * (xyz1[0]! - xyz0[0]!),
                xyz0[1]! + f * (xyz1[1]! - xyz0[1]!),
                xyz0[2]! + f * (xyz1[2]! - xyz0[2]!),
                alpha,
            );
        case 'lrgb':
            return rgbWithAlpha(
                Math.sqrt(
                    Math.pow(xyz0[0]!, 2) * (1 - f) + Math.pow(xyz1[0]!, 2) * f,
                ),
                Math.sqrt(
                    Math.pow(xyz0[1]!, 2) * (1 - f) + Math.pow(xyz1[1]!, 2) * f,
                ),
                Math.sqrt(
                    Math.pow(xyz0[2]!, 2) * (1 - f) + Math.pow(xyz1[2]!, 2) * f,
                ),
                alpha,
            );
        default:
            // like chroma.mix, always set alpha: it normalizes alpha (oklab can leave it unset) and the clipped flag
            return mixOpaque(xyz0, xyz1, f, mode).alpha(alpha);
    }
}

/**
 * chroma(r, g, b, 'rgb').alpha(alpha) with one Color construction instead of two. alpha() rebuilds the
 * color from its already-clipped channels, so clipping first (as chroma's clip_rgb does) gives the same
 * channels and clipping record. The clip is not only defensive: lrgb can overshoot, e.g. to
 * 255.00000000000003 between two 255 channels.
 */
function rgbWithAlpha(r: number, g: number, b: number, alpha: number): Color {
    return chroma.rgb(
        clamp(r, 0, 255),
        clamp(g, 0, 255),
        clamp(b, 0, 255),
        alpha,
    );
}

function mixOpaque(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: Exclude<InterpolationMode, 'rgb' | 'lrgb'>,
): Color {
    switch (mode) {
        case 'lab':
        case 'oklab':
            return chroma(
                xyz0[0]! + f * (xyz1[0]! - xyz0[0]!),
                xyz0[1]! + f * (xyz1[1]! - xyz0[1]!),
                xyz0[2]! + f * (xyz1[2]! - xyz0[2]!),
                mode,
            );
        default:
            return mixHsx(xyz0, xyz1, f, mode);
    }
}

/**
 * Hue-based modes, mirroring chroma-js's _hsx interpolator: shortest way around the hue circle,
 * and a missing hue (a gray) takes the other color's.
 */
function mixHsx(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: 'hsl' | 'hsv' | 'hsi' | 'lch' | 'hcl' | 'oklch',
): Color {
    const m = mode === 'lch' ? 'hcl' : mode;
    const [hue0, sat0, lbv0] = xyz0 as [number, number, number];
    const [hue1, sat1, lbv1] = xyz1 as [number, number, number];

    let sat: number | undefined;
    let hue: number;
    if (!isNaN(hue0) && !isNaN(hue1)) {
        let dh: number;
        if (hue1 > hue0 && hue1 - hue0 > 180) {
            dh = hue1 - (hue0 + 360);
        } else if (hue1 < hue0 && hue0 - hue1 > 180) {
            dh = hue1 + 360 - hue0;
        } else {
            dh = hue1 - hue0;
        }
        hue = hue0 + f * dh;
    } else if (!isNaN(hue0)) {
        hue = hue0;
        if ((lbv1 == 1 || lbv1 == 0) && m != 'hsv') sat = sat0;
    } else if (!isNaN(hue1)) {
        hue = hue1;
        if ((lbv0 == 1 || lbv0 == 0) && m != 'hsv') sat = sat1;
    } else {
        hue = Number.NaN;
    }
    if (sat === undefined) sat = sat0 + f * (sat1 - sat0);
    const lbv = lbv0 + f * (lbv1 - lbv0);
    return m === 'oklch' ? chroma(lbv, sat, hue, m) : chroma(hue, sat, lbv, m);
}

/**
 * The colors of chroma.scale(colors).mode(mode).domain([0, nSteps]) at 0, 1, …, nSteps - 1: what
 * scale.colors(nSteps + 1, null) returns, minus the sample at nSteps (the last stop; in a ColorPalette,
 * a repeat of the first). The scale builds every sample with chroma.mix, which converts both ends of the
 * segment to the mode's coordinates (except in rgb and lrgb) and builds each color twice; this converts
 * each stop once. Mirrors chroma-js 3's scale (src/generator/scale.js): the same sample positions,
 * computed the same way, and the stops themselves (not copies) wherever a sample lands on one.
 * nSteps must be a positive integer and there must be at least two colors.
 */
export function sampleScale(
    colors: Color[],
    mode: InterpolationMode,
    nSteps: number,
): Color[] {
    // like the scale, run the colors through chroma(): Color instances come back as they are, and
    // anything else chroma accepts is converted
    const stops = colors.map((color) => chroma(color));
    const last = stops.length - 1;
    const positions = stops.map((_, i) => i / last);
    const coords = stops.map((stop) => toModeCoords(stop, mode));
    const alphas = stops.map((stop) => stop.alpha());

    const sampleAt = (t: number): Color => {
        for (let i = 0; i < last; i++) {
            const p = positions[i]!;
            if (t <= p) {
                return stops[i]!;
            }
            const next = positions[i + 1]!;
            if (t < next) {
                return mixCoords(
                    coords[i]!,
                    coords[i + 1]!,
                    (t - p) / (next - p),
                    mode,
                    alphas[i]!,
                    alphas[i + 1]!,
                );
            }
        }
        return stops[last]!;
    };

    // sized up front: an array grown by pushing keeps its spare capacity for as long as the palette lives
    const sampled = new Array<Color>(nSteps);
    for (let step = 0; step < nSteps; step++) {
        // chroma's arithmetic, kept rather than simplified to step / nSteps so the rounding matches:
        // scale.colors spreads its samples over the domain [0, nSteps], and the scale maps each back to [0, 1]
        sampled[step] = sampleAt(
            Math.min(Math.max(0, ((step / nSteps) * nSteps) / nSteps), 1),
        );
    }
    return sampled;
}
