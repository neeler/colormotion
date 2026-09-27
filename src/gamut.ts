import chroma, { Color } from 'chroma-js';
import type { ColorInput } from './ColorPalette';

/*
 * Colors measured by OKLCH hue, relative chroma and HSV value, and the colors those measures give back.
 *
 * Hue is OKLCH hue, as chroma-js computes it at its default Lab white point (D65). Brightness is HSV value:
 * the hottest channel in encoded sRGB, the measure minBrightness already uses. Relative chroma is a color's
 * OKLCH chroma as a fraction of the most sRGB allows at its hue and brightness.
 *
 * The most saturated color at a hue and brightness V always lies on the edge of the sRGB cube where one
 * channel is V and another is 0: hsv(θ, 1, V). In linear light, the edge colors at every V are the same
 * colors scaled, and OKLab scales with the cube root of linear light, so an edge color's hue depends only on
 * where it lies along the edge, and its chroma is the chroma at V = 1 times the cube root of V's linear
 * value. The solver works on the edge at V = 1 and scales.
 */

/**
 * The measures of a color.
 */
export interface ColorMeasure {
    /**
     * OKLCH hue in degrees, from 0 to 360. null for a color with no hue: an OKLCH chroma under 1e-4 (greys,
     * white) or black.
     */
    hue: number | null;
    /**
     * Relative chroma, from 0 to 1: the color's OKLCH chroma as a fraction of the most any sRGB color has at
     * its hue and brightness (see maxChroma). 0 is grey and 1 is as saturated as sRGB allows there.
     * In the 0.16° of hue just past blue's, where the colors of one brightness have no chroma between two
     * values, the fraction leaves that gap out, so that every value from 0 to 1 is a color there too.
     */
    chroma: number;
    /**
     * Brightness: HSV value, from 0 to 1 (the hottest channel), after any lift to minBrightness.
     */
    brightness: number;
}

/** Iterations of each bisection: the edge search and the lightness search. */
const ITERATIONS = 48;

/** Colors whose OKLCH chroma is under this have no hue. */
const MIN_HUE_CHROMA = 1e-4;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** A 3×3 matrix, row by row. */
type Matrix = readonly number[];

/** chroma-js's sRGB (linear) to XYZ matrix (src/io/lab/lab-constants.js). */
const RGB_TO_XYZ: Matrix = [
    0.4124564390896922, 0.357576077643909, 0.18043748326639894,
    0.21267285140562253, 0.715152155287818, 0.07217499330655958,
    0.0193338955823293, 0.11919202588130297, 0.9503040785363679,
];
/** chroma-js's XYZ to LMS matrix (src/io/oklab/rgb2oklab.js). */
const XYZ_TO_LMS: Matrix = [
    0.819022437996703, 0.3619062600528904, -0.1288737815209879,
    0.0329836539323885, 0.9292868615863434, 0.0361446663506424,
    0.0481771893596242, 0.2642395317527308, 0.6335478284694309,
];
/** chroma-js's LMS (cube roots) to OKLab matrix (src/io/oklab/rgb2oklab.js). */
const LMS_TO_OKLAB: Matrix = [
    0.210454268309314, 0.7936177747023054, -0.0040720430116193,
    1.9779985324311684, -2.4285922420485799, 0.450593709617411,
    0.0259040424655478, 0.7827717124575296, -0.8086757549230774,
];

function multiply(a: Matrix, b: Matrix): Matrix {
    const product: number[] = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            product.push(
                a[3 * i]! * b[j]! +
                    a[3 * i + 1]! * b[3 + j]! +
                    a[3 * i + 2]! * b[6 + j]!,
            );
        }
    }
    return product;
}

function invert(m: Matrix): Matrix {
    const [a, b, c, d, e, f, g, h, i] = m.map((entry) => entry);
    const cofactors = [
        e! * i! - f! * h!,
        c! * h! - b! * i!,
        b! * f! - c! * e!,
        f! * g! - d! * i!,
        a! * i! - c! * g!,
        c! * d! - a! * f!,
        d! * h! - e! * g!,
        b! * g! - a! * h!,
        a! * e! - b! * d!,
    ];
    const det = a! * cofactors[0]! + b! * cofactors[3]! + c! * cofactors[6]!;
    return cofactors.map((cofactor) => cofactor / det);
}

/** Writes m · (x, y, z) to out. */
function apply(m: Matrix, x: number, y: number, z: number, out: number[]) {
    out[0] = m[0]! * x + m[1]! * y + m[2]! * z;
    out[1] = m[3]! * x + m[4]! * y + m[5]! * z;
    out[2] = m[6]! * x + m[7]! * y + m[8]! * z;
}

/** Linear sRGB to LMS, the way chroma-js converts to OKLab (through XYZ). */
const RGB_TO_LMS = multiply(XYZ_TO_LMS, RGB_TO_XYZ);
/** The exact inverses of the conversion to OKLab, so a color found here measures back as its target. */
const LMS_TO_RGB = invert(RGB_TO_LMS);
const OKLAB_TO_LMS = invert(LMS_TO_OKLAB);

/** chroma-js's sRGB decoding (src/io/lab/rgb2lab.js), for a channel from 0 to 1. */
function toLinear(channel: number) {
    return channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** chroma-js's sRGB encoding (src/io/lab/lab2rgb.js), for a linear channel of 0 or more. */
function toEncoded(linear: number) {
    return linear <= 0.0031308
        ? linear * 12.92
        : 1.055 * Math.pow(linear, 1.0 / 2.4) - 0.055;
}

/** A number from 0 to 1; NaN counts as 0. */
function unit(n: number) {
    return n > 0 ? Math.min(n, 1) : 0;
}

/** Degrees, wrapped into [0, 360). */
function wrap(degrees: number) {
    const wrapped = degrees % 360;
    // a hair under 0 wraps to 360 in floating point
    return wrapped < 0 ? (wrapped + 360) % 360 : wrapped + 0;
}

/** Scratch for the conversions (the solver is synchronous, so one of each is enough). */
const lms = [0, 0, 0];
const lab = [0, 0, 0];
const rgb = [0, 0, 0];

/** OKLab of a linear sRGB color, written to lab as [L, a, b]. */
function linearToOklab(r: number, g: number, b: number) {
    apply(RGB_TO_LMS, r, g, b, lms);
    apply(
        LMS_TO_OKLAB,
        Math.cbrt(lms[0]!),
        Math.cbrt(lms[1]!),
        Math.cbrt(lms[2]!),
        lab,
    );
}

/** Linear sRGB of an OKLab color, unclipped, written to rgb. */
function oklabToLinear(L: number, a: number, b: number) {
    apply(OKLAB_TO_LMS, L, a, b, lms);
    const [l, m, s] = lms as [number, number, number];
    apply(LMS_TO_RGB, l * l * l, m * m * m, s * s * s, rgb);
}

/**
 * The six sectors of the edge, in HSV hue order from red: the channel at full value, the channel that runs
 * between 0 and full, and whether it rises along the sector. The third channel is 0.
 */
const SECTORS: readonly {
    max: number;
    mid: number;
    rising: boolean;
}[] = [
    { max: 0, mid: 1, rising: true }, // red to yellow
    { max: 1, mid: 0, rising: false }, // yellow to green
    { max: 1, mid: 2, rising: true }, // green to cyan
    { max: 2, mid: 1, rising: false }, // cyan to blue
    { max: 2, mid: 0, rising: true }, // blue to magenta
    { max: 0, mid: 2, rising: false }, // magenta to red
];

/**
 * The linear sRGB of the edge color at position t (0 to 1) along a sector, at V = 1: its middle channel is
 * the linear ratio of the middle channel to the full one.
 */
function edgeColor(sector: number, t: number, out: number[]) {
    const { max, mid, rising } = SECTORS[sector]!;
    out[0] = out[1] = out[2] = 0;
    out[max] = 1;
    out[mid] = rising ? t : 1 - t;
}

/** The OKLab of the edge color at position t along a sector, written to lab. */
function edgeOklab(sector: number, t: number) {
    edgeColor(sector, t, rgb);
    linearToOklab(rgb[0]!, rgb[1]!, rgb[2]!);
}

/** The OKLCH hue of the edge color at position t along a sector. */
function edgeHue(sector: number, t: number) {
    edgeOklab(sector, t);
    return wrap(Math.atan2(lab[2]!, lab[1]!) * RAD2DEG);
}

/** The OKLCH chroma of the edge color at position t along a sector, at V = 1. */
function edgeChroma(sector: number, t: number) {
    edgeOklab(sector, t);
    return Math.hypot(lab[1]!, lab[2]!);
}

/** A position between lo and hi, found by bisection: `before(t)` says whether it lies past t. */
function bisect(lo: number, hi: number, before: (t: number) => boolean) {
    for (let i = 0; i < ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        if (before(mid)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

/** The hue at the start of each sector: red, yellow, green, cyan, blue and magenta. */
const SECTOR_HUES = SECTORS.map((_, sector) => edgeHue(sector, 0));

const CYAN_TO_BLUE = 3;
const BLUE_TO_MAGENTA = 4;

/** Degrees from the start of a sector to a hue, from −90 to 270, so a hue a hair before the start is negative. */
function fromSectorStart(sector: number, hue: number) {
    const degrees = wrap(hue - SECTOR_HUES[sector]!);
    return degrees > 270 ? degrees - 360 : degrees;
}

/**
 * A hue this close under a sector's start counts as the start: the start's own color, measured along
 * another path (a darker blue, or chroma-js's conversion), can land a hair either side of it.
 */
const SECTOR_START_TOLERANCE = 1e-9;

/**
 * The sector that holds the hue: each runs from its start to the next sector's start, [start, next).
 */
function sectorOf(hue: number) {
    const offset = wrap(hue - SECTOR_HUES[0]!) + SECTOR_START_TOLERANCE;
    let sector = 0;
    for (let k = 1; k < SECTORS.length; k++) {
        if (offset >= wrap(SECTOR_HUES[k]! - SECTOR_HUES[0]!)) {
            sector = k;
        }
    }
    return sector;
}

/*
 * The blue fold. Along the edge from cyan to blue, the hue rises past blue's (264.05°) to 264.21° and turns
 * back, so the hues from 264.05° to 264.21° lie on the edge three times: twice between azure and blue (as the
 * hue rises, and as it falls back), and once just past blue, toward magenta. The last is the most saturated,
 * so it sets the most chroma those hues allow, and #0000ff measures relative chroma 1. The sectors' half-open
 * ranges hand those hues to the sector after blue, and leave the sector before blue only the hues under
 * blue's, which it crosses once, so a bisection along either sector finds the crossing wanted.
 *
 * At those hues, the colors of one brightness form two separate pieces of the cube's face: one reaching
 * from grey to the first crossing, the other joining the second and third crossings around blue. No color
 * has a chroma between the first crossing's and the second's. Relative chroma counts only the chromas that
 * exist, leaving that gap out, so every relative chroma from 0 to 1 is a color at every hue, and it runs
 * on continuously from the hues on either side. (The most chroma a hue allows still jumps at blue's hue,
 * by 9 %: just under it, the most saturated color is an azure-leaning blue, #0037ff at full value.)
 */

/** Where the cyan-to-blue sector's hue peaks. */
const FOLD_PEAK = (() => {
    let lo = 0.5;
    let hi = 1;
    for (let i = 0; i < 100; i++) {
        const a = lo + (hi - lo) / 3;
        const b = hi - (hi - lo) / 3;
        if (
            fromSectorStart(CYAN_TO_BLUE, edgeHue(CYAN_TO_BLUE, a)) <
            fromSectorStart(CYAN_TO_BLUE, edgeHue(CYAN_TO_BLUE, b))
        ) {
            lo = a;
        } else {
            hi = b;
        }
    }
    return (lo + hi) / 2;
})();

/** How far past blue's hue the fold reaches, in degrees (about 0.16). */
const FOLD_WIDTH = fromSectorStart(
    BLUE_TO_MAGENTA,
    edgeHue(CYAN_TO_BLUE, FOLD_PEAK),
);

/** The chromas sRGB reaches at a hue, at V = 1. */
interface Reach {
    /** The sector and position along it of the most saturated edge color at the hue. */
    sector: number;
    t: number;
    /** Its chroma: the most at the hue. */
    chroma: number;
    /** In the blue fold, the chromas between which no color lies (the first and second crossings'). */
    gap: [number, number] | null;
}

/** The chromas sRGB reaches at an OKLCH hue, at V = 1, with the gap in the blue fold when asked for. */
function reachAt(hue: number, withGap = false): Reach {
    const sector = sectorOf(hue);
    const target = fromSectorStart(sector, hue);
    const t = bisect(
        0,
        1,
        (mid) => fromSectorStart(sector, edgeHue(sector, mid)) < target,
    );
    let gap: [number, number] | null = null;
    if (withGap && sector === BLUE_TO_MAGENTA && target < FOLD_WIDTH) {
        const fromCyan = fromSectorStart(CYAN_TO_BLUE, hue);
        const hueAt = (mid: number) =>
            fromSectorStart(CYAN_TO_BLUE, edgeHue(CYAN_TO_BLUE, mid));
        const rising = bisect(0, FOLD_PEAK, (mid) => hueAt(mid) < fromCyan);
        const falling = bisect(FOLD_PEAK, 1, (mid) => hueAt(mid) > fromCyan);
        gap = [
            edgeChroma(CYAN_TO_BLUE, rising),
            edgeChroma(CYAN_TO_BLUE, falling),
        ];
    }
    return { sector, t, chroma: edgeChroma(sector, t), gap };
}

/** The relative chroma of an OKLCH chroma at V = 1, leaving out any gap. */
function toRelative(C: number, { chroma: most, gap }: Reach) {
    if (!gap) {
        return C / most;
    }
    const [below, above] = gap;
    const missing = Math.max(0, above - below);
    return (C <= below ? C : Math.max(below, C - missing)) / (most - missing);
}

/** The OKLCH chroma at V = 1 of a relative chroma, stepping over any gap. */
function fromRelative(fraction: number, { chroma: most, gap }: Reach) {
    if (!gap) {
        return fraction * most;
    }
    const [below, above] = gap;
    const missing = Math.max(0, above - below);
    const C = fraction * (most - missing);
    return C <= below ? C : C + missing;
}

/**
 * The OKLCH chroma of the most saturated sRGB color at this OKLCH hue (degrees, wrapped) and brightness (HSV
 * value, clamped to 0–1). That color lies on the edge of the sRGB cube where one channel is the brightness and
 * another is 0: hsv(θ, 1, brightness) for some HSV hue θ. 0 for a brightness of 0, and for a hue that is not a
 * finite number.
 *
 * Just past blue's hue, from 264.05° to 264.21°, the edge passes three times, and the most saturated of the
 * three sets it: so #0000ff has the most chroma at its hue.
 */
export function maxChroma(hue: number, brightness: number): number {
    const value = unit(brightness);
    if (!Number.isFinite(hue) || value === 0) {
        return 0;
    }
    return reachAt(hue).chroma * Math.cbrt(toLinear(value));
}

/**
 * A color's OKLCH hue, relative chroma and brightness (HSV value). Alpha is ignored.
 *
 * With minBrightness, a color darker than it is first lifted to it by scaling its channels together, which
 * keeps its HSV hue and saturation (the lift ColorPalette.randomizeFrom gives its seed); black lifts to grey.
 * This measures a color as it shows when a theme lifts colors to a floor.
 */
export function measureColor(
    color: ColorInput,
    options?: { minBrightness?: number },
): ColorMeasure {
    const minBrightness = unit(options?.minBrightness ?? 0);
    let [r, g, b] = chroma(color)
        .rgb(false)
        .map((channel) => channel / 255) as [number, number, number];
    let value = Math.max(r, g, b);
    if (value < minBrightness) {
        if (value > 0) {
            const lift = minBrightness / value;
            r *= lift;
            g *= lift;
            b *= lift;
        } else {
            r = g = b = minBrightness;
        }
        value = Math.max(r, g, b);
    }

    linearToOklab(toLinear(r), toLinear(g), toLinear(b));
    const C = Math.hypot(lab[1]!, lab[2]!);
    if (value <= 0 || C < MIN_HUE_CHROMA) {
        return { hue: null, chroma: 0, brightness: value };
    }
    const hue = wrap(Math.atan2(lab[2]!, lab[1]!) * RAD2DEG);
    const unitChroma = C / Math.cbrt(toLinear(value));
    return {
        hue,
        chroma: Math.min(1, toRelative(unitChroma, reachAt(hue, true))),
        brightness: value,
    };
}

/**
 * The color at an OKLCH hue (degrees, wrapped), brightness (HSV value, 0–1) and relative chroma (0–1), at full
 * precision: the channels are not rounded to 8 bits, and every one lies within 0–1, so the color is in gamut.
 * measureColor gives the target back.
 *
 * Chroma 1 is the edge color hsv(θ, 1, brightness) at that hue exactly, and chroma 0 is the grey (brightness,
 * brightness, brightness). Brightness 0 is black. Values outside 0–1 are clamped, NaN counts as 0, and a hue
 * that is not a finite number gives the grey.
 */
export function colorFromHue(target: {
    hue: number;
    brightness: number;
    chroma: number;
}): Color {
    const value = unit(target.brightness);
    const fraction = unit(target.chroma);
    if (value === 0) {
        return chroma.gl(0, 0, 0, 1);
    }
    if (fraction === 0 || !Number.isFinite(target.hue)) {
        return chroma.gl(value, value, value, 1);
    }

    const hue = wrap(target.hue);
    const reach = reachAt(hue, true);
    if (fraction === 1) {
        edgeColor(reach.sector, reach.t, rgb);
    } else {
        // at V = 1: the lightness at which the hottest channel is 1 (linear), at this chroma
        const C = fromRelative(fraction, reach);
        const a = C * Math.cos(hue * DEG2RAD);
        const b = C * Math.sin(hue * DEG2RAD);
        const lightness = bisect(0, 1, (mid) => {
            oklabToLinear(mid, a, b);
            return Math.max(rgb[0]!, rgb[1]!, rgb[2]!) < 1;
        });
        oklabToLinear(lightness, a, b);
    }

    // scale to the brightness in linear light, then encode, clipping the solver's noise (about 1e-12)
    const linearValue = toLinear(value);
    const channel = (linear: number) =>
        Math.min(1, toEncoded(Math.max(0, linear * linearValue)));
    return chroma.gl(channel(rgb[0]!), channel(rgb[1]!), channel(rgb[2]!), 1);
}
