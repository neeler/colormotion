import chroma, { Color, Scale } from 'chroma-js';
import { RequireExactlyOne } from 'type-fest';

/**
 * Supported interpolation modes.
 */
declare const InterpolationModes: {
    readonly rgb: "rgb";
    readonly lab: "lab";
    readonly lrgb: "lrgb";
    readonly hsl: "hsl";
    readonly lch: "lch";
    readonly hsv: "hsv";
    readonly hsi: "hsi";
    readonly hcl: "hcl";
};
type InterpolationMode = (typeof InterpolationModes)[keyof typeof InterpolationModes];
/**
 * Get the next interpolation mode.
 */
declare function getNextInterpolationMode(mode: InterpolationMode): InterpolationMode;

/**
 * String or chroma-js color.
 */
type ColorInput = string | Color;
type ColorPaletteConfig = RequireExactlyOne<{
    /**
     * The colors to use in the palette.
     */
    colors: ColorInput[];
    /**
     * The normalized colors to use in the palette.
     */
    normalizedColors: Color[];
}> & {
    /**
     * The interpolation mode to use between colors in the palette.
     */
    mode: InterpolationMode;
    /**
     * The number of steps in the color scale.
     */
    nSteps: number;
    /**
     * The minimum threshold for the CIEDE2000 color distance between colors in the palette.
     * Defaults to 20.
     */
    deltaEThreshold?: number;
};
/**
 * An immutable ColorPalette.
 */
declare class ColorPalette {
    readonly colors: chroma.Color[];
    readonly hexes: string[];
    readonly key: string;
    readonly nColors: number;
    readonly mode: InterpolationMode;
    readonly nSteps: number;
    readonly scale: Scale;
    readonly scaleColors: Color[];
    private readonly maxNumberOfColors;
    private readonly deltaEThreshold;
    /**
     * Normalizes the input colors to chroma-js colors.
     */
    static normalizeColors(colorInputs: ColorInput[]): chroma.Color[];
    private static analyzeColors;
    constructor({ colors, mode, nSteps, normalizedColors, deltaEThreshold, }: ColorPaletteConfig);
    /**
     * Creates a new palette with the specified configuration.
     */
    newConfig({ colors, nSteps, mode, }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
    }): ColorPalette;
    /**
     * Gets a new palette with new colors but the same mode.
     */
    newColors(colors: ColorInput[]): ColorPalette;
    /**
     * Gets a new palette with the same colors but a different mode.
     */
    newMode(mode: InterpolationMode): ColorPalette;
    /**
     * Gets a new palette with the same colors but the next mode.
     */
    rotateMode(): ColorPalette;
    /**
     * Randomizes the palette starting with the input color.
     *
     * @param seed The color to start with.
     * @param options Options for randomizing the palette.
     * @param options.minBrightness The minimum brightness for the colors.
     * @returns A new palette with randomized colors.
     */
    randomizeFrom(seed: ColorInput, { minBrightness, }?: {
        minBrightness?: number;
    }): ColorPalette;
    /**
     * Randomizes the whole palette with a random number of colors.
     */
    randomize(nColors?: number): ColorPalette;
    /**
     * Adds the specified color.
     */
    push(color: ColorInput): ColorPalette;
    /**
     * Adds a random color.
     */
    pushRandom(): ColorPalette;
    /**
     * Drops the oldest color.
     */
    popOldest(): ColorPalette;
    /**
     * Drops the oldest color and pushes the new color.
     */
    rotateOn(color: ColorInput): ColorPalette;
    /**
     * Drops the oldest color and adds a random color.
     */
    rotateRandomOn(): ColorPalette;
}

interface ThemeConfig {
    /**
     * The number of steps in the color scale.
     * Defaults to 2048.
     */
    nSteps?: number;
    /**
     * The color interpolation mode to use between colors in the palette.
     * Defaults to RGB.
     */
    mode?: InterpolationMode;
    /**
     * The initial colors in the palette.
     * Defaults to red, green, and blue.
     */
    colors?: ColorInput[];
    /**
     * The minimum threshold for the CIEDE2000 color distance between colors in the palette.
     * Defaults to 20.
     */
    deltaEThreshold?: number;
    /**
     * A callback function to call when the theme is updated.
     */
    onUpdate?: (colors: string[]) => void | Promise<void>;
}
interface ColorUpdateConfig {
    /**
     * The speed of the transition between two palettes.
     */
    transitionSpeed?: number;
}
/**
 * A dynamic color theme that can be updated and transitioned between different color palettes.
 */
declare class Theme {
    private readonly config?;
    readonly nSteps: number;
    /**
     * The active palette to use for color generation.
     */
    palette: ColorPalette;
    /**
     * The target palette to transition to.
     */
    targetPalette?: ColorPalette;
    private _brightness;
    /**
     * The interpolation mode to use between colors in the palette.
     */
    mode: InterpolationMode;
    private transitionSpeed;
    private iColor;
    private previousColorDistance?;
    private readonly colorDistanceThreshold;
    private colors;
    constructor(config?: ThemeConfig | undefined);
    private get scale();
    /**
     * The active palette to use for color generation.
     */
    get activePalette(): ColorPalette;
    /**
     * The hex values of the colors in the active palette.
     */
    get activePaletteHexes(): string[];
    /**
     * The relative brightness of the theme.
     */
    get brightness(): number;
    /**
     * Set the relative brightness of the theme.
     */
    set brightness(brightness: number);
    private getBaseColor;
    /**
     * Get the color at the given index in the theme.
     * @param index The index of the color to get.
     * @param options Options for the color generation.
     * @param options.brightness Optionally adjust the brightness of the color. 0-255, defaults to 255.
     * @returns The color at the given index.
     */
    getColor(index?: number, { brightness }?: {
        brightness?: number;
    }): chroma.Color;
    /**
     * Update the theme to a new set of colors.
     *
     * transitionSpeed should be between (0,1)
     */
    private updateScale;
    /**
     * Update the theme to a new set of colors, steps, and interpolation mode.
     */
    update({ colors, nSteps, mode, }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
    }, options?: ColorUpdateConfig): void;
    /**
     * Set the interpolation mode of the theme.
     */
    setMode(mode?: InterpolationMode, options?: ColorUpdateConfig): void;
    /**
     * Rotate the interpolation mode of the theme.
     */
    rotateMode(options?: ColorUpdateConfig): void;
    /**
     * Set the colors of the theme.
     */
    setColors(colorInputs: ColorInput[], options?: ColorUpdateConfig): void;
    /**
     * Randomize the colors of the theme based on a seed color.
     */
    randomFrom(color: ColorInput, { minBrightness, ...options }: ColorUpdateConfig & {
        minBrightness?: number;
    }): void;
    /**
     * Randomize the colors of the theme.
     */
    randomTheme(options?: ColorUpdateConfig): void;
    /**
     * Get the color at the given index in the theme.
     * Rounds and normalizes the index so that it is within the bounds of the color scale.
     */
    normalizeIndex(index?: number): number;
    /**
     * Push a new color to the end of the palette.
     */
    pushNewColor(color: ColorInput, options?: ColorUpdateConfig): void;
    /**
     * Push a random color to the end of the palette.
     */
    pushRandomColor(options?: ColorUpdateConfig): void;
    /**
     * Pop the oldest color from the palette.
     */
    popOldestColor(options?: ColorUpdateConfig): void;
    /**
     * Drops the oldest color and pushes the new color.
     */
    rotateColor(color: ColorInput, options?: ColorUpdateConfig): void;
    /**
     * Drops the oldest color and pushes a random color.
     */
    rotateRandomColor(options?: ColorUpdateConfig): void;
    private clearTargetPalette;
    /**
     * Move the color index by n steps.
     * Can be negative to move backwards.
     */
    tick(n?: number): void;
}

/**
 * Maps a brightness value (1-255) to a darken factor (3-0).
 */
declare const mapBrightnessToDarkenFactor: (value: number) => number;

export { type ColorInput, ColorPalette, type ColorPaletteConfig, type InterpolationMode, InterpolationModes, Theme, type ThemeConfig, getNextInterpolationMode, mapBrightnessToDarkenFactor };
