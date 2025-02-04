import chroma, { Color, Scale } from 'chroma-js';
import { RequireExactlyOne } from 'type-fest';

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
declare function getNextInterpolationMode(mode: InterpolationMode): InterpolationMode;

type ColorInput = string | Color;
type ColorPaletteConfig = RequireExactlyOne<{
    colors: ColorInput[];
    normalizedColors: Color[];
}> & {
    mode: InterpolationMode;
    nSteps: number;
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
    static normalizeColors(colorInputs: ColorInput[]): chroma.Color[];
    private static analyzeColors;
    constructor({ colors, mode, nSteps, normalizedColors, deltaEThreshold, }: ColorPaletteConfig);
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
    nSteps?: number;
    mode?: InterpolationMode;
    colors?: ColorInput[];
    onUpdate?: (colors: string[]) => void | Promise<void>;
    deltaEThreshold?: number;
}
interface ColorUpdateConfig {
    transitionSpeed?: number;
}
declare class Theme {
    private readonly config?;
    readonly nSteps: number;
    palette: ColorPalette;
    targetPalette?: ColorPalette;
    private _brightness;
    mode: InterpolationMode;
    private transitionSpeed;
    private iColor;
    private previousColorDistance?;
    private readonly colorDistanceThreshold;
    private colors;
    constructor(config?: ThemeConfig | undefined);
    private get scale();
    get activePalette(): ColorPalette;
    get activePaletteHexes(): string[];
    get brightness(): number;
    set brightness(brightness: number);
    private getBaseColor;
    getColor(index?: number, { brightness }?: {
        brightness?: number;
    }): chroma.Color;
    /**
     * Transition Speed should be between (0,1)
     */
    private updateScale;
    update({ colors, nSteps, mode, }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
    }, options?: ColorUpdateConfig): void;
    setMode(mode?: InterpolationMode, options?: ColorUpdateConfig): void;
    rotateMode(options?: ColorUpdateConfig): void;
    setColors(colorInputs: ColorInput[], options?: ColorUpdateConfig): void;
    randomFrom(color: ColorInput, { minBrightness, ...options }: ColorUpdateConfig & {
        minBrightness?: number;
    }): void;
    randomTheme(options?: ColorUpdateConfig): void;
    normalizeIndex(index?: number): number;
    pushNewColor(color: ColorInput, options?: ColorUpdateConfig): void;
    pushRandomColor(options?: ColorUpdateConfig): void;
    popOldestColor(options?: ColorUpdateConfig): void;
    rotateColor(color: ColorInput, options?: ColorUpdateConfig): void;
    rotateRandomColor(options?: ColorUpdateConfig): void;
    private clearTargetPalette;
    tick(n?: number): void;
}

declare const mapBrightnessToDarkenFactor: (value: number) => number;

export { type ColorInput, ColorPalette, type ColorPaletteConfig, type InterpolationMode, InterpolationModes, Theme, type ThemeConfig, getNextInterpolationMode, mapBrightnessToDarkenFactor };
