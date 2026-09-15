/**
 * Supported interpolation modes.
 */
export const InterpolationModes = {
    rgb: 'rgb',
    lab: 'lab',
    lrgb: 'lrgb',
    hsl: 'hsl',
    lch: 'lch',
    hsv: 'hsv',
    hsi: 'hsi',
    hcl: 'hcl',
    oklab: 'oklab',
    oklch: 'oklch',
} as const;

export type InterpolationMode =
    (typeof InterpolationModes)[keyof typeof InterpolationModes];

/**
 * Array of interpolation modes.
 */
const InterpolationModeArray = [
    InterpolationModes.rgb,
    InterpolationModes.lab,
    InterpolationModes.lrgb,
    InterpolationModes.hsl,
    InterpolationModes.lch,
    InterpolationModes.hsv,
    InterpolationModes.hsi,
    InterpolationModes.hcl,
    InterpolationModes.oklab,
    InterpolationModes.oklch,
] as const;

/**
 * Get the next interpolation mode.
 */
export function getNextInterpolationMode(mode: InterpolationMode) {
    const index = InterpolationModeArray.indexOf(mode);
    return InterpolationModeArray[
        (index + 1) % InterpolationModeArray.length
    ] as InterpolationMode;
}
