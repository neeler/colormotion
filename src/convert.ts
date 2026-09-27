import chroma from 'chroma-js';

/*
 * Color conversions that write sRGB channels into a float buffer instead of building a chroma-js Color,
 * for Theme.fillRgb. Each mirrors chroma-js 3's own conversion (src/io/*) expression for expression, and
 * then clips as its Color constructor does (src/utils/clip_rgb.js), so the channels written are the ones
 * the Color chroma would build holds, not just close to them: 0-255, unrounded. The Lab-based conversions
 * (lab, lch, hcl, oklab, oklch and darkening) use chroma's default white point, D65; see isD65WhitePoint.
 */

/** chroma's Lab constants (src/io/lab/lab-constants.js), at its default white point, D65. */
const Kn = 18;
const Xn = 0.95047;
const Yn = 1;
const Zn = 1.08883;
const kE = 216.0 / 24389.0;
const kKE = 8.0;
const kK = 24389.0 / 27.0;
const RefWhiteRGB = { X: 0.95047, Y: 1, Z: 1.08883 };
const MtxRGB2XYZ = {
    m00: 0.4124564390896922,
    m01: 0.21267285140562253,
    m02: 0.0193338955823293,
    m10: 0.357576077643909,
    m11: 0.715152155287818,
    m12: 0.11919202588130297,
    m20: 0.18043748326639894,
    m21: 0.07217499330655958,
    m22: 0.9503040785363679,
};
const MtxXYZ2RGB = {
    m00: 3.2404541621141045,
    m01: -0.9692660305051868,
    m02: 0.055643430959114726,
    m10: -1.5371385127977166,
    m11: 1.8760108454466942,
    m12: -0.2040259135167538,
    m20: -0.498531409556016,
    m21: 0.041556017530349834,
    m22: 1.0572251882231791,
};
const MtxAdaptMa = {
    m00: 0.8951,
    m01: -0.7502,
    m02: 0.0389,
    m10: 0.2664,
    m11: 1.7135,
    m12: -0.0685,
    m20: -0.1614,
    m21: 0.0367,
    m22: 1.0296,
};
const MtxAdaptMaI = {
    m00: 0.9869929054667123,
    m01: 0.43230526972339456,
    m02: -0.008528664575177328,
    m10: -0.14705425642099013,
    m11: 0.5183602715367776,
    m12: 0.04004282165408487,
    m20: 0.15996265166373125,
    m21: 0.0492912282128556,
    m22: 0.9684866957875502,
};

/**
 * The white point's cone responses, as xyz2rgb and rgb2xyz compute them on every call (Xn·Ma, per column).
 */
const WhiteA = Xn * MtxAdaptMa.m00 + Yn * MtxAdaptMa.m10 + Zn * MtxAdaptMa.m20;
const WhiteB = Xn * MtxAdaptMa.m01 + Yn * MtxAdaptMa.m11 + Zn * MtxAdaptMa.m21;
const WhiteC = Xn * MtxAdaptMa.m02 + Yn * MtxAdaptMa.m12 + Zn * MtxAdaptMa.m22;

/** xyz2rgb's chromatic adaptation factors, Ad / As and so on (exactly 1 at D65). */
const ToRgbA =
    (RefWhiteRGB.X * MtxAdaptMa.m00 +
        RefWhiteRGB.Y * MtxAdaptMa.m10 +
        RefWhiteRGB.Z * MtxAdaptMa.m20) /
    WhiteA;
const ToRgbB =
    (RefWhiteRGB.X * MtxAdaptMa.m01 +
        RefWhiteRGB.Y * MtxAdaptMa.m11 +
        RefWhiteRGB.Z * MtxAdaptMa.m21) /
    WhiteB;
const ToRgbC =
    (RefWhiteRGB.X * MtxAdaptMa.m02 +
        RefWhiteRGB.Y * MtxAdaptMa.m12 +
        RefWhiteRGB.Z * MtxAdaptMa.m22) /
    WhiteC;

/** rgb2xyz's, against the As, Bs and Cs chroma stores as constants (also exactly 1 at D65). */
const FromRgbA = WhiteA / 0.9414285350000001;
const FromRgbB = WhiteB / 1.040417467;
const FromRgbC = WhiteC / 1.089532651;

const DEG2RAD = Math.PI / 180;
const TWOPI = Math.PI * 2;
const PITHIRD = Math.PI / 3;

/**
 * Whether chroma-js is on its default Lab white point, D65, which the Lab-based conversions here assume.
 * chroma.setLabWhitePoint changes it for every Lab conversion chroma makes.
 */
export function isD65WhitePoint() {
    const whitePoint: string = chroma.getLabWhitePoint();
    return whitePoint === 'd65' || whitePoint.toLowerCase() === 'd65';
}

/** chroma's clip_rgb, for one channel. */
function clip(channel: number) {
    return Math.min(Math.max(0, channel), 255);
}

/** chroma's sRGB companding (src/io/lab/lab2rgb.js). */
function compand(linear: number) {
    const sign = Math.sign(linear);
    linear = Math.abs(linear);
    return (
        (linear <= 0.0031308
            ? linear * 12.92
            : 1.055 * Math.pow(linear, 1.0 / 2.4) - 0.055) * sign
    );
}

/** chroma's inverse sRGB companding (src/io/lab/rgb2lab.js). */
function gammaAdjustSRGB(companded: number) {
    const sign = Math.sign(companded);
    companded = Math.abs(companded);
    const linear =
        companded <= 0.04045
            ? companded / 12.92
            : Math.pow((companded + 0.055) / 1.055, 2.4);
    return linear * sign;
}

/** XYZ (D65) to sRGB: chroma's xyz2rgb, clipped. */
function xyzToRgb(
    x: number,
    y: number,
    z: number,
    out: Float64Array,
    o: number,
) {
    const X1 =
        (x * MtxAdaptMa.m00 + y * MtxAdaptMa.m10 + z * MtxAdaptMa.m20) * ToRgbA;
    const Y1 =
        (x * MtxAdaptMa.m01 + y * MtxAdaptMa.m11 + z * MtxAdaptMa.m21) * ToRgbB;
    const Z1 =
        (x * MtxAdaptMa.m02 + y * MtxAdaptMa.m12 + z * MtxAdaptMa.m22) * ToRgbC;

    const X2 =
        X1 * MtxAdaptMaI.m00 + Y1 * MtxAdaptMaI.m10 + Z1 * MtxAdaptMaI.m20;
    const Y2 =
        X1 * MtxAdaptMaI.m01 + Y1 * MtxAdaptMaI.m11 + Z1 * MtxAdaptMaI.m21;
    const Z2 =
        X1 * MtxAdaptMaI.m02 + Y1 * MtxAdaptMaI.m12 + Z1 * MtxAdaptMaI.m22;

    out[o] = clip(
        compand(
            X2 * MtxXYZ2RGB.m00 + Y2 * MtxXYZ2RGB.m10 + Z2 * MtxXYZ2RGB.m20,
        ) * 255,
    );
    out[o + 1] = clip(
        compand(
            X2 * MtxXYZ2RGB.m01 + Y2 * MtxXYZ2RGB.m11 + Z2 * MtxXYZ2RGB.m21,
        ) * 255,
    );
    out[o + 2] = clip(
        compand(
            X2 * MtxXYZ2RGB.m02 + Y2 * MtxXYZ2RGB.m12 + Z2 * MtxXYZ2RGB.m22,
        ) * 255,
    );
}

/** CIELAB to sRGB: chroma(L, a, b, 'lab') (lab2xyz, then xyz2rgb). */
export function labToRgb(
    L: number,
    a: number,
    b: number,
    out: Float64Array,
    o: number,
) {
    const fy = (L + 16.0) / 116.0;
    const fx = 0.002 * a + fy;
    const fz = fy - 0.005 * b;

    const fx3 = fx * fx * fx;
    const fz3 = fz * fz * fz;

    const xr = fx3 > kE ? fx3 : (116.0 * fx - 16.0) / kK;
    const yr = L > kKE ? Math.pow((L + 16.0) / 116.0, 3.0) : L / kK;
    const zr = fz3 > kE ? fz3 : (116.0 * fz - 16.0) / kK;

    xyzToRgb(xr * Xn, yr * Yn, zr * Zn, out, o);
}

/**
 * OKLab to sRGB: chroma(L, a, b, 'oklab'). The matrix products add up from 0 in column order, as chroma's
 * multiplyMatrices does.
 */
export function oklabToRgb(
    L: number,
    a: number,
    b: number,
    out: Float64Array,
    o: number,
) {
    const l = Math.pow(
        0 + 1.0 * L + 0.3963377773761749 * a + 0.2158037573099136 * b,
        3,
    );
    const m = Math.pow(
        0 + 1.0 * L + -0.1055613458156586 * a + -0.0638541728258133 * b,
        3,
    );
    const s = Math.pow(
        0 + 1.0 * L + -0.0894841775298119 * a + -1.2914855480194092 * b,
        3,
    );
    xyzToRgb(
        0 +
            1.2268798758459243 * l +
            -0.5578149944602171 * m +
            0.2813910456659647 * s,
        0 +
            -0.0405757452148008 * l +
            1.112286803280317 * m +
            -0.0717110580655164 * s,
        0 +
            -0.0763729366746601 * l +
            -0.4214933324022432 * m +
            1.5869240198367816 * s,
        out,
        o,
    );
}

/** CIE LCh to sRGB, given as hue, chroma and lightness: chroma(h, c, l, 'hcl') (lch2lab, then lab2rgb). */
export function hclToRgb(
    h: number,
    c: number,
    l: number,
    out: Float64Array,
    o: number,
) {
    if (isNaN(h)) h = 0;
    h = h * DEG2RAD;
    labToRgb(l, Math.cos(h) * c, Math.sin(h) * c, out, o);
}

/** OKLCh to sRGB: chroma(l, c, h, 'oklch') (lch2lab, then oklab2rgb). */
export function oklchToRgb(
    l: number,
    c: number,
    h: number,
    out: Float64Array,
    o: number,
) {
    if (isNaN(h)) h = 0;
    h = h * DEG2RAD;
    oklabToRgb(l, Math.cos(h) * c, Math.sin(h) * c, out, o);
}

/** One hsl2rgb channel, from its hue offset t. */
function hslChannel(t: number, t1: number, t2: number) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (6 * t < 1) return t1 + (t2 - t1) * 6 * t;
    if (2 * t < 1) return t2;
    if (3 * t < 2) return t1 + (t2 - t1) * (2 / 3 - t) * 6;
    return t1;
}

/** HSL to sRGB: chroma(h, s, l, 'hsl'). */
export function hslToRgb(
    h: number,
    s: number,
    l: number,
    out: Float64Array,
    o: number,
) {
    if (s === 0) {
        out[o] = out[o + 1] = out[o + 2] = clip(l * 255);
        return;
    }
    const t2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const t1 = 2 * l - t2;
    const h_ = h / 360;
    out[o] = clip(hslChannel(h_ + 1 / 3, t1, t2) * 255);
    out[o + 1] = clip(hslChannel(h_, t1, t2) * 255);
    out[o + 2] = clip(hslChannel(h_ - 1 / 3, t1, t2) * 255);
}

/**
 * HSV to sRGB: chroma(h, s, v, 'hsv'). A hue that lands outside the six sectors (NaN) leaves chroma's
 * channels undefined, which its clip turns into NaN.
 */
export function hsvToRgb(
    h: number,
    s: number,
    v: number,
    out: Float64Array,
    o: number,
) {
    v *= 255;
    let r = Number.NaN;
    let g = Number.NaN;
    let b = Number.NaN;
    if (s === 0) {
        r = g = b = v;
    } else {
        if (h === 360) h = 0;
        if (h > 360) h -= 360;
        if (h < 0) h += 360;
        h /= 60;

        const i = Math.floor(h);
        const f = h - i;
        const p = v * (1 - s);
        const q = v * (1 - s * f);
        const t = v * (1 - s * (1 - f));

        // chroma destructures a new array in each case; assigning the channels one by one is the same
        switch (i) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
            case 1:
                r = q;
                g = v;
                b = p;
                break;
            case 2:
                r = p;
                g = v;
                b = t;
                break;
            case 3:
                r = p;
                g = q;
                b = v;
                break;
            case 4:
                r = t;
                g = p;
                b = v;
                break;
            case 5:
                r = v;
                g = p;
                b = q;
                break;
        }
    }
    out[o] = clip(r);
    out[o + 1] = clip(g);
    out[o + 2] = clip(b);
}

/** HSI to sRGB: chroma(h, s, i, 'hsi'). */
export function hsiToRgb(
    h: number,
    s: number,
    i: number,
    out: Float64Array,
    o: number,
) {
    let r: number;
    let g: number;
    let b: number;

    if (isNaN(h)) h = 0;
    if (isNaN(s)) s = 0;
    if (h > 360) h -= 360;
    if (h < 0) h += 360;
    h /= 360;
    if (h < 1 / 3) {
        b = (1 - s) / 3;
        r = (1 + (s * Math.cos(TWOPI * h)) / Math.cos(PITHIRD - TWOPI * h)) / 3;
        g = 1 - (b + r);
    } else if (h < 2 / 3) {
        h -= 1 / 3;
        r = (1 - s) / 3;
        g = (1 + (s * Math.cos(TWOPI * h)) / Math.cos(PITHIRD - TWOPI * h)) / 3;
        b = 1 - (r + g);
    } else {
        h -= 2 / 3;
        g = (1 - s) / 3;
        b = (1 + (s * Math.cos(TWOPI * h)) / Math.cos(PITHIRD - TWOPI * h)) / 3;
        r = 1 - (g + b);
    }
    out[o] = clip(Math.min(Math.max(0, i * r * 3), 1) * 255);
    out[o + 1] = clip(Math.min(Math.max(0, i * g * 3), 1) * 255);
    out[o + 2] = clip(Math.min(Math.max(0, i * b * 3), 1) * 255);
}

/**
 * color.darken(amount), for the sRGB channels at rgb[i..i + 2] (0-255, as a Color holds them), written to
 * out[o..o + 2]: chroma's rgb2lab, the lightness lowered by 18 per unit of amount, then lab2rgb. rgb and
 * out may be the same buffer.
 */
export function darkenRgb(
    rgb: Float64Array,
    i: number,
    amount: number,
    out: Float64Array,
    o: number,
) {
    const r = gammaAdjustSRGB(rgb[i]! / 255);
    const g = gammaAdjustSRGB(rgb[i + 1]! / 255);
    const b = gammaAdjustSRGB(rgb[i + 2]! / 255);

    let x = r * MtxRGB2XYZ.m00 + g * MtxRGB2XYZ.m10 + b * MtxRGB2XYZ.m20;
    let y = r * MtxRGB2XYZ.m01 + g * MtxRGB2XYZ.m11 + b * MtxRGB2XYZ.m21;
    let z = r * MtxRGB2XYZ.m02 + g * MtxRGB2XYZ.m12 + b * MtxRGB2XYZ.m22;

    let X = x * MtxAdaptMa.m00 + y * MtxAdaptMa.m10 + z * MtxAdaptMa.m20;
    let Y = x * MtxAdaptMa.m01 + y * MtxAdaptMa.m11 + z * MtxAdaptMa.m21;
    let Z = x * MtxAdaptMa.m02 + y * MtxAdaptMa.m12 + z * MtxAdaptMa.m22;

    X *= FromRgbA;
    Y *= FromRgbB;
    Z *= FromRgbC;

    x = X * MtxAdaptMaI.m00 + Y * MtxAdaptMaI.m10 + Z * MtxAdaptMaI.m20;
    y = X * MtxAdaptMaI.m01 + Y * MtxAdaptMaI.m11 + Z * MtxAdaptMaI.m21;
    z = X * MtxAdaptMaI.m02 + Y * MtxAdaptMaI.m12 + Z * MtxAdaptMaI.m22;

    // xyz2lab
    const xr = x / Xn;
    const yr = y / Yn;
    const zr = z / Zn;

    const fx = xr > kE ? Math.pow(xr, 1.0 / 3.0) : (kK * xr + 16.0) / 116.0;
    const fy = yr > kE ? Math.pow(yr, 1.0 / 3.0) : (kK * yr + 16.0) / 116.0;
    const fz = zr > kE ? Math.pow(zr, 1.0 / 3.0) : (kK * zr + 16.0) / 116.0;

    darkenLab(
        116.0 * fy - 16.0,
        500.0 * (fx - fy),
        200.0 * (fy - fz),
        amount,
        out,
        o,
    );
}

/**
 * color.darken(amount), for a color given as its Lab coordinates (what color.lab() returns, and darken reads
 * first): the lightness lowered by 18 per unit of amount, then lab2rgb, written to out[o..o + 2].
 */
function darkenLab(
    L: number,
    a: number,
    b: number,
    amount: number,
    out: Float64Array,
    o: number,
) {
    labToRgb(L - Kn * amount, a, b, out, o);
}

/**
 * Darkens every color in a buffer as color.darken(amount) darkens each, and writes their sRGB channels
 * (0-255) to out. The colors are given as their sRGB channels (0-255), as a Color holds them, or, when isLab
 * is true, as their Lab coordinates (color.lab()), which saves darken's conversion to Lab. from and out may
 * be the same buffer.
 */
export function darkenScale(
    from: Float64Array,
    isLab: boolean,
    amount: number,
    out: Float64Array,
) {
    const end = from.length;
    if (isLab) {
        for (let o = 0; o < end; o += 3) {
            darkenLab(from[o]!, from[o + 1]!, from[o + 2]!, amount, out, o);
        }
    } else {
        for (let o = 0; o < end; o += 3) {
            darkenRgb(from, o, amount, out, o);
        }
    }
}
