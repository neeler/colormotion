import chroma, { Color } from 'chroma-js';
import { InterpolationMode } from './InterpolationMode';

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
 * Mirrors chroma-js 3's interpolators (src/interpolator/*.js) expression for expression,
 * so results are identical, not just close.
 */
export function mixCoords(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: InterpolationMode,
    alpha0 = 1,
    alpha1 = 1,
): Color {
    // like chroma.mix, always set alpha: it normalizes alpha (oklab can leave it unset) and the clipped flag
    return mixOpaque(xyz0, xyz1, f, mode).alpha(alpha0 + f * (alpha1 - alpha0));
}

function mixOpaque(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: InterpolationMode,
): Color {
    switch (mode) {
        case 'rgb':
            return chroma(
                xyz0[0]! + f * (xyz1[0]! - xyz0[0]!),
                xyz0[1]! + f * (xyz1[1]! - xyz0[1]!),
                xyz0[2]! + f * (xyz1[2]! - xyz0[2]!),
                'rgb',
            );
        case 'lrgb':
            return chroma(
                Math.sqrt(
                    Math.pow(xyz0[0]!, 2) * (1 - f) + Math.pow(xyz1[0]!, 2) * f,
                ),
                Math.sqrt(
                    Math.pow(xyz0[1]!, 2) * (1 - f) + Math.pow(xyz1[1]!, 2) * f,
                ),
                Math.sqrt(
                    Math.pow(xyz0[2]!, 2) * (1 - f) + Math.pow(xyz1[2]!, 2) * f,
                ),
                'rgb',
            );
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
