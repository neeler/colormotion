import chroma, { Color, Scale } from 'chroma-js';
import {
    InterpolationMode,
    getNextInterpolationMode,
} from './InterpolationMode';
import { clamp } from './clamp';

/**
 * String or chroma-js color.
 */
export type ColorInput = string | Color;

/**
 * Default minimum CIEDE2000 distance between consecutive random colors.
 */
export const DEFAULT_DELTA_E_THRESHOLD = 20;

/**
 * Default maximum number of colors in a palette.
 */
export const DEFAULT_MAX_NUMBER_OF_COLORS = 8;

/**
 * Maximum number of candidates drawn when searching for a random color
 * that satisfies the deltaE threshold. If none qualifies, the most
 * distant candidate is used.
 */
const MAX_RANDOM_COLOR_ATTEMPTS = 100;

/**
 * Exactly one of `colors` or `normalizedColors` must be provided.
 */
export type ColorPaletteColors =
    | {
          /**
           * The colors to use in the palette.
           */
          colors: ColorInput[];
          normalizedColors?: never;
      }
    | {
          colors?: never;
          /**
           * The normalized colors to use in the palette.
           * Don't use this unless you know what you're doing.
           */
          normalizedColors: Color[];
      };

export type ColorPaletteConfig = ColorPaletteColors & {
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
    /**
     * Max number of colors in the palette.
     * Defaults to 8.
     */
    maxNumberOfColors?: number;
};

export interface RandomPaletteConfig {
    /**
     * The number of colors in the palette.
     */
    nColors?: number;
    /**
     * The minimum brightness for the colors.
     */
    minBrightness?: number;
}

export interface RandomColorConfig extends Pick<
    RandomPaletteConfig,
    'minBrightness'
> {}

/**
 * An immutable ColorPalette.
 */
export class ColorPalette {
    readonly colors: chroma.Color[];
    readonly hexes: string[];
    readonly key: string;
    readonly nColors: number;
    readonly mode: InterpolationMode;
    readonly nSteps: number;
    readonly scale: Scale;
    readonly scaleColors: Color[];
    readonly maxNumberOfColors: number;
    readonly deltaEThreshold: number;

    /**
     * Normalizes the input colors to chroma-js colors.
     */
    static normalizeColors(colorInputs: ColorInput[]) {
        const colors = colorInputs.map((value) => chroma(value));

        // Ensure that the palette has colors
        const firstColor = colors[0] ?? chroma('green');
        colors[0] = firstColor;

        const firstHex = firstColor.hex();
        const lastHex = colors[colors.length - 1]?.hex();

        // Ensure that we don't already have a color loop
        if (colors.length > 1 && firstHex === lastHex) {
            colors.pop();
        }

        // Ensure that wheel loops back to first color
        colors.push(firstColor);

        return colors;
    }

    static clampColors(colors: ColorInput[], maxNumberOfColors: number) {
        if (colors.length <= maxNumberOfColors) {
            return colors;
        }

        return colors.slice(0, maxNumberOfColors);
    }

    private static analyzeColors(colors: ColorInput[]) {
        const normalizedColors = ColorPalette.normalizeColors(colors);
        const key = normalizedColors.map((c) => c.hex()).join(':');

        return {
            key,
            normalizedColors,
        };
    }

    /**
     * Returns a new random palette with the specified number of colors.
     * Defaults to 5 colors.
     */
    static random({
        nColors = 5,
        minBrightness = 0,
        ...config
    }: Omit<ColorPaletteConfig, 'colors' | 'normalizedColors'> &
        RandomPaletteConfig) {
        const deltaEThreshold =
            config.deltaEThreshold ?? DEFAULT_DELTA_E_THRESHOLD;

        let lastColor = ColorPalette.randomColor(minBrightness);
        const colors = [lastColor];

        while (colors.length < nColors) {
            const nextColor = ColorPalette.getNewRandomColor(lastColor, {
                minBrightness,
                deltaEThreshold,
            });
            colors.push(nextColor);
            lastColor = nextColor;
        }

        return new ColorPalette({
            ...config,
            colors,
        });
    }

    constructor({
        colors,
        mode,
        nSteps,
        normalizedColors,
        deltaEThreshold = DEFAULT_DELTA_E_THRESHOLD,
        maxNumberOfColors = DEFAULT_MAX_NUMBER_OF_COLORS,
    }: ColorPaletteConfig) {
        this.mode = mode;
        this.nSteps = nSteps;
        this.maxNumberOfColors = maxNumberOfColors;
        this.deltaEThreshold = deltaEThreshold;
        this.colors = normalizedColors ?? ColorPalette.normalizeColors(colors);

        if (this.colors.length > maxNumberOfColors + 1) {
            // Crop the colors to the max number of colors
            this.colors = ColorPalette.normalizeColors(
                ColorPalette.clampColors(this.colors, maxNumberOfColors).concat(
                    this.colors[0],
                ),
            );
        }

        // Don't count the duplicate color at the end of the wheel
        this.nColors = this.colors.length - 1;

        this.hexes = this.colors.map((c) => c.hex());
        this.key = this.hexes.join(':');

        this.scale = chroma
            .scale(this.colors)
            .mode(mode)
            .domain([0, nSteps])
            .out(null);
        // chroma's scale cache keys on floor(t * 10000), which would collapse
        // adjacent steps for large nSteps. Each step is only sampled once anyway.
        this.scale.cache(false);
        // Request Color objects directly rather than hex strings, which would
        // quantize the scale to 8 bits per channel before any mixing happens.
        const scaleColors = this.scale.colors(nSteps + 1, null);
        scaleColors.pop();
        this.scaleColors = scaleColors;
    }

    /**
     * The settings that derived palettes inherit from this one.
     */
    private get derivedConfig() {
        return {
            mode: this.mode,
            nSteps: this.nSteps,
            deltaEThreshold: this.deltaEThreshold,
            maxNumberOfColors: this.maxNumberOfColors,
        };
    }

    /**
     * Creates a new palette with the specified configuration.
     * Options not provided are inherited from this palette.
     */
    newConfig({
        colors,
        nSteps,
        mode,
        maxNumberOfColors = this.maxNumberOfColors,
        deltaEThreshold = this.deltaEThreshold,
    }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
        maxNumberOfColors?: number;
        deltaEThreshold?: number;
    }) {
        const modeIsSame = mode === this.mode;
        const nStepsIsSame = nSteps === this.nSteps;
        const settingsAreSame =
            maxNumberOfColors === this.maxNumberOfColors &&
            deltaEThreshold === this.deltaEThreshold;

        if (modeIsSame && nStepsIsSame && settingsAreSame) {
            return this.newColors(colors);
        }

        const { key, normalizedColors } = ColorPalette.analyzeColors(colors);
        const colorsAreSame = key === this.key;

        if (nStepsIsSame && colorsAreSame && settingsAreSame) {
            return this.newMode(mode);
        }

        return new ColorPalette({
            mode,
            nSteps,
            normalizedColors,
            maxNumberOfColors,
            deltaEThreshold,
        });
    }

    /**
     * Gets a new palette with new colors but the same mode.
     */
    newColors(colors: ColorInput[]) {
        const { key, normalizedColors } = ColorPalette.analyzeColors(colors);

        if (key === this.key) {
            return this;
        }

        return new ColorPalette({
            ...this.derivedConfig,
            normalizedColors,
        });
    }

    /**
     * Gets a new palette with the same colors but a different mode.
     */
    newMode(mode: InterpolationMode) {
        if (mode === this.mode) {
            return this;
        }

        return new ColorPalette({
            ...this.derivedConfig,
            mode,
            colors: this.colors,
        });
    }

    /**
     * Gets a new palette with the same colors but the next mode.
     */
    rotateMode() {
        return this.newMode(getNextInterpolationMode(this.mode));
    }

    /**
     * Randomizes the palette starting with the input color.
     * Maintains the number of colors in the palette.
     *
     * @param seed The color to start with.
     * @param options Options for randomizing the palette.
     * @returns A new palette with randomized colors.
     */
    randomizeFrom(
        seed: ColorInput,
        { nColors = this.nColors, minBrightness = 0 }: RandomPaletteConfig = {},
    ) {
        let lastColor = chroma(seed);
        if (lastColor.get('hsv.v') < minBrightness) {
            lastColor = lastColor.set('hsv.v', minBrightness);
        }
        const colors = [lastColor];

        while (colors.length < nColors) {
            const nextColor = ColorPalette.getNewRandomColor(lastColor, {
                minBrightness,
                deltaEThreshold: this.deltaEThreshold,
            });
            colors.push(nextColor);
            lastColor = nextColor;
        }

        return this.newColors(colors);
    }

    /**
     * Randomizes the whole palette.
     * Maintains the number of colors in the palette.
     */
    randomize({
        minBrightness = 0,
        nColors = this.nColors,
    }: RandomPaletteConfig = {}) {
        return this.randomizeFrom(ColorPalette.randomColor(minBrightness), {
            nColors,
            minBrightness,
        });
    }

    /**
     * Adds the specified color.
     */
    push(color: ColorInput) {
        if (this.nColors >= this.maxNumberOfColors) {
            return this;
        }

        return this.newColors(
            this.colors.slice(0, this.nColors).concat(chroma(color)),
        );
    }

    /**
     * Draws a random color with a brightness (HSV value) of at least minBrightness.
     */
    private static randomColor(minBrightness = 0) {
        const brightness = clamp(
            Math.random() * (1 - minBrightness) + minBrightness,
            0,
            1,
        );

        return chroma({
            h: Math.random() * 360,
            s: Math.random(),
            v: brightness,
        });
    }

    /**
     * Draws a random color at least deltaEThreshold away from previousColor.
     * Gives up after a bounded number of attempts and returns the most
     * distant candidate found, so a strict threshold can never hang.
     */
    private static getNewRandomColor(
        previousColor: Color,
        {
            minBrightness = 0,
            deltaEThreshold = 0,
        }: RandomColorConfig & {
            deltaEThreshold?: number;
        } = {},
    ) {
        let bestColor: Color | undefined;
        let bestDistance = -Infinity;

        for (let attempt = 0; attempt < MAX_RANDOM_COLOR_ATTEMPTS; attempt++) {
            const candidate = ColorPalette.randomColor(minBrightness);
            const distance = chroma.deltaE(previousColor, candidate, 1, 1, 1);

            if (distance >= deltaEThreshold) {
                return candidate;
            }
            if (distance > bestDistance) {
                bestColor = candidate;
                bestDistance = distance;
            }
        }

        return bestColor ?? ColorPalette.randomColor(minBrightness);
    }

    /**
     * Adds a random color.
     */
    pushRandom(randomColorConfig: RandomColorConfig = {}) {
        return this.push(
            ColorPalette.getNewRandomColor(this.colors[this.nColors - 1]!, {
                deltaEThreshold: this.deltaEThreshold,
                ...randomColorConfig,
            }),
        );
    }

    /**
     * Drops the oldest color.
     */
    popOldest() {
        if (this.nColors < 2) {
            return this;
        }

        return this.newColors(this.hexes.slice(1, this.hexes.length - 1));
    }

    /**
     * Drops the oldest color and pushes the new color.
     */
    rotateOn(color: ColorInput) {
        const newColors: ColorInput[] = [
            ...this.hexes.slice(1, this.hexes.length - 1),
            color,
        ];
        return this.newColors(newColors);
    }

    /**
     * Drops the oldest color and adds a random color.
     */
    rotateRandomOn(options?: RandomColorConfig) {
        return this.rotateOn(
            ColorPalette.getNewRandomColor(this.colors[this.nColors - 1]!, {
                deltaEThreshold: this.deltaEThreshold,
                ...options,
            }),
        );
    }
}
