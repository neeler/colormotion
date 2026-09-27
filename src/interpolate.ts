import chroma, { Color } from 'chroma-js';
import { InterpolationMode } from './InterpolationMode';
import { clamp } from './clamp';
import {
    hclToRgb,
    hsiToRgb,
    hslToRgb,
    hsvToRgb,
    labToRgb,
    oklabToRgb,
    oklchToRgb,
} from './convert';

/**
 * A color's coordinates in the space an interpolation mode mixes in, as chroma-js reads them: three
 * numbers, in the order its mix reads them, and never alpha, which mixCoords mixes on its own.
 * Converting once and reusing the coordinates is what makes repeated mixing cheap: chroma.mix converts
 * both colors on every call.
 */
export type ModeCoords = number[];

/**
 * The coordinates chroma.mix(color, ·, f, mode) would read from `color`, with two departures:
 * - Alpha is left out. chroma's lab, oklab, hcl and oklch getters add it after the coordinates when it
 *   is below 1, and hsl's always; its mix reads only the first three, except in OKLCH, where it reverses
 *   the whole array: a translucent color reads as [alpha, h, C, L], and its alpha is mixed as the hue
 *   (halfway from a translucent red to a translucent blue is still red). Here a translucent color has
 *   the same coordinates as the opaque one.
 * - A saturated color gets an HSI hue where chroma's rounding leaves none (see hsiHue).
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
            return withoutAlpha(color.lab());
        case 'oklab':
            return withoutAlpha(color.oklab());
        case 'hsl':
            return withoutAlpha(color.hsl());
        case 'hsv':
            return color.hsv();
        case 'hsi': {
            const hsi = color.hsi();
            if (isNaN(hsi[0]!) && hsi[1]! > 0) {
                hsi[0] = hsiHue(color);
            }
            return hsi;
        }
        case 'lch':
        case 'hcl':
            return withoutAlpha(color.hcl());
        case 'oklch': {
            const [l, c, h] = color.oklch() as [number, number, number];
            return [h, c, l];
        }
    }
}

/**
 * A getter's coordinates without the alpha chroma may add after them. The array is the getter's own,
 * so the alpha is popped off in place (setting its length to 3 would be much slower).
 */
function withoutAlpha(coords: number[]): ModeCoords {
    if (coords.length > 3) coords.pop();
    return coords;
}

/**
 * The HSI hue of a saturated color, as chroma-js computes it (src/io/hsi/rgb2hsi.js) but with the
 * arccosine's argument clamped to [-1, 1]. For colors that come out of HSI mixing, such as halfway
 * from red to black, (127.5, 1.4e-14, 0), rounding puts it a hair outside [-1, 1], and chroma returns
 * NaN, as if the color were a gray.
 */
function hsiHue(color: Color) {
    const [r255, g255, b255] = color.rgb(false) as [number, number, number];
    const r = r255 / 255;
    const g = g255 / 255;
    const b = b255 / 255;
    const cos =
        (r - g + (r - b)) /
        2 /
        Math.sqrt((r - g) * (r - g) + (r - b) * (g - b));
    let h = Math.acos(clamp(cos, -1, 1));
    if (b > g) {
        h = 2 * Math.PI - h;
    }
    return (h / (2 * Math.PI)) * 360;
}

/**
 * Mixes two colors given their mode coordinates: the same result as
 * chroma.mix(color0, color1, f, mode), without converting either color.
 * Mirrors the arithmetic of chroma-js 3's interpolators (src/interpolator/*.js) expression for
 * expression and builds the same Color chroma.mix returns, so results are identical, not just close,
 * except where chroma's mix can't reach an endpoint (see mixHsx) and for translucent colors in OKLCH,
 * which mix as the opaque colors do (see toModeCoords). Alpha is mixed on its own, as chroma.mix
 * mixes it: linearly, from alpha0 to alpha1.
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
 * Whether mixing toward a hue-less end with this lightness keeps the other color's saturation, as chroma
 * does: only where the end looks the same at any saturation (black and white in HSL, black in HSI).
 */
function keepsSaturation(mode: string, lbv: number) {
    return (
        (mode === 'hsl' && (lbv === 1 || lbv === 0)) ||
        (mode === 'hsi' && lbv === 0)
    );
}

/** The hue, saturation and lightness mixHsx mixes, before it builds the color from them. */
const HSX = new Float64Array(3);

/**
 * Hue-based modes, mirroring chroma-js's _hsx interpolator: shortest way around the hue circle,
 * and a missing hue (a gray) takes the other color's. Two departures, so every mix reaches its ends:
 * - When one end has no hue and a lightness of exactly 0 or 1 on the mode's scale, chroma keeps the
 *   other color's saturation (chroma) the whole way. That is harmless where such a color looks the same
 *   at any saturation: black and white in HSL, black in HSI, so it stays there. But in LCH, HCL and
 *   OKLCH it applies to black (lightness 0), and the mix never gets there: red toward black ends as a
 *   dark red. In HSI it applies to white (intensity 1), and blue toward white stays blue. There the
 *   saturation runs to the other end's own, as it does toward any gray.
 * - In HSV, a hue a hair below 0 wraps to exactly 360, which chroma turns into NaN channels, so hues
 *   are wrapped into [0, 360) first.
 */
function mixHsx(
    xyz0: ModeCoords,
    xyz1: ModeCoords,
    f: number,
    mode: 'hsl' | 'hsv' | 'hsi' | 'lch' | 'hcl' | 'oklch',
): Color {
    const m = mode === 'lch' ? 'hcl' : mode;
    mixHues(
        xyz0[0]!,
        xyz0[1]!,
        xyz0[2]!,
        xyz1[0]!,
        xyz1[1]!,
        xyz1[2]!,
        f,
        m,
        HSX,
        0,
    );
    const hue = HSX[0]!;
    const sat = HSX[1]!;
    const lbv = HSX[2]!;
    return m === 'oklch' ? chroma(lbv, sat, hue, m) : chroma(hue, sat, lbv, m);
}

/**
 * The hue, saturation and lightness (or value, or intensity) of mixHsx's mix of two colors' coordinates
 * (lch as hcl), written to out[o], out[o + 1] and out[o + 2]. Shared with mixScaleRgb.
 */
function mixHues(
    hue0: number,
    sat0: number,
    lbv0: number,
    hue1: number,
    sat1: number,
    lbv1: number,
    f: number,
    m: 'hsl' | 'hsv' | 'hsi' | 'hcl' | 'oklch',
    out: Float64Array,
    o: number,
) {
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
        if (keepsSaturation(m, lbv1)) sat = sat0;
    } else if (!isNaN(hue1)) {
        hue = hue1;
        if (keepsSaturation(m, lbv0)) sat = sat1;
    } else {
        hue = Number.NaN;
    }
    if (m === 'hsv') {
        if (hue < 0) hue += 360;
        if (hue >= 360) hue -= 360;
    }
    if (sat === undefined) sat = sat0 + f * (sat1 - sat0);
    out[o] = hue;
    out[o + 1] = sat;
    out[o + 2] = lbv0 + f * (lbv1 - lbv0);
}

/**
 * The space a mode mixes in, as scaleCoords keys it: lrgb mixes rgb's coordinates, and lch hcl's.
 */
function coordSpace(mode: InterpolationMode): InterpolationMode {
    return mode === 'lrgb' ? 'rgb' : mode === 'lch' ? 'hcl' : mode;
}

/** scaleCoords' buffers, by color list and space. */
const scaleCoordsCache = new WeakMap<
    readonly Color[],
    Map<InterpolationMode, Float64Array>
>();

/**
 * The mode coordinates (toModeCoords) of every color in a list, three numbers per color, in a
 * buffer built on first use and kept for as long as the list is: a palette's scaleColors, or the colors a
 * Theme transition starts from. In rgb and lrgb they are the colors' sRGB channels, 0-255. The list must
 * not change afterwards (palettes don't change theirs).
 */
export function scaleCoords(
    colors: readonly Color[],
    mode: InterpolationMode,
): Float64Array {
    const space = coordSpace(mode);
    let spaces = scaleCoordsCache.get(colors);
    if (!spaces) {
        spaces = new Map();
        scaleCoordsCache.set(colors, spaces);
    }
    let coords = spaces.get(space);
    if (!coords) {
        coords = new Float64Array(colors.length * 3);
        for (let i = 0; i < colors.length; i++) {
            const color = toModeCoords(colors[i]!, space);
            coords[i * 3] = color[0]!;
            coords[i * 3 + 1] = color[1]!;
            coords[i * 3 + 2] = color[2]!;
        }
        spaces.set(space, coords);
    }
    return coords;
}

/**
 * Mixes two lists of mode coordinates (from scaleCoords, in the same mode) a fraction f of the way, and
 * writes each mix's sRGB channels to out: for every color k, the channels (0-255, unrounded) of
 * mixCoords(from_k, to_k, f, mode), without building a Color. The conversions mirror chroma-js's (see
 * convert.ts), so the channels are the same, and the Lab-based ones assume the D65 white point.
 */
export function mixScaleRgb(
    from: Float64Array,
    to: Float64Array,
    f: number,
    mode: InterpolationMode,
    out: Float64Array,
) {
    const end = out.length;
    switch (mode) {
        // rgb and lrgb clamp as rgbWithAlpha does, written out: clamp(channel, 0, 255)
        case 'rgb':
            for (let o = 0; o < end; o++) {
                const channel = from[o]! + f * (to[o]! - from[o]!);
                out[o] = Math.min(Math.max(channel, 0), 255);
            }
            return;
        case 'lrgb':
            for (let o = 0; o < end; o++) {
                const channel = Math.sqrt(
                    Math.pow(from[o]!, 2) * (1 - f) + Math.pow(to[o]!, 2) * f,
                );
                out[o] = Math.min(Math.max(channel, 0), 255);
            }
            return;
        case 'lab':
        case 'oklab': {
            const toRgb = mode === 'lab' ? labToRgb : oklabToRgb;
            for (let o = 0; o < end; o += 3) {
                toRgb(
                    from[o]! + f * (to[o]! - from[o]!),
                    from[o + 1]! + f * (to[o + 1]! - from[o + 1]!),
                    from[o + 2]! + f * (to[o + 2]! - from[o + 2]!),
                    out,
                    o,
                );
            }
            return;
        }
        default: {
            const m = mode === 'lch' ? 'hcl' : mode;
            for (let o = 0; o < end; o += 3) {
                // mix into out, then convert in place
                mixHues(
                    from[o]!,
                    from[o + 1]!,
                    from[o + 2]!,
                    to[o]!,
                    to[o + 1]!,
                    to[o + 2]!,
                    f,
                    m,
                    out,
                    o,
                );
                const hue = out[o]!;
                const sat = out[o + 1]!;
                const lbv = out[o + 2]!;
                switch (m) {
                    case 'hsl':
                        hslToRgb(hue, sat, lbv, out, o);
                        break;
                    case 'hsv':
                        hsvToRgb(hue, sat, lbv, out, o);
                        break;
                    case 'hsi':
                        hsiToRgb(hue, sat, lbv, out, o);
                        break;
                    case 'hcl':
                        hclToRgb(hue, sat, lbv, out, o);
                        break;
                    case 'oklch':
                        oklchToRgb(lbv, sat, hue, out, o);
                        break;
                }
            }
        }
    }
}

/**
 * The colors of chroma.scale(colors).mode(mode).domain([0, nSteps]) at 0, 1, …, nSteps - 1: what
 * scale.colors(nSteps + 1, null) returns, minus the sample at nSteps (the last stop; in a ColorPalette,
 * a repeat of the first). The scale builds every sample with chroma.mix, which converts both ends of the
 * segment to the mode's coordinates (except in rgb and lrgb) and builds each color twice; this converts
 * each stop once. Mirrors chroma-js 3's scale (src/generator/scale.js): the same sample positions,
 * computed the same way, and the stops themselves (not copies) wherever a sample lands on one.
 * nSteps must be a positive finite number and there must be at least two colors.
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

    // scale.colors(nSteps + 1) spreads its samples over the domain [0, nSteps], (nSteps + 1) - 1 apart
    // (which rounds for a fractional nSteps), and the scale maps each back to [0, 1]. chroma's arithmetic
    // is kept as is so the rounding matches; the last sample (the domain's end) is dropped.
    const numColors = nSteps + 1;
    const spacing = numColors - 1;
    const count = Math.ceil(numColors) - 1;
    // sized up front: an array grown by pushing keeps its spare capacity for as long as the palette lives
    const sampled = new Array<Color>(count);
    for (let step = 0; step < count; step++) {
        sampled[step] = sampleAt(
            Math.min(Math.max(0, ((step / spacing) * nSteps) / nSteps), 1),
        );
    }
    return sampled;
}
