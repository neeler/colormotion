import chroma, { Color, Scale } from 'chroma-js';
import { RequireExactlyOne } from 'type-fest';
import {
    InterpolationMode,
    getNextInterpolationMode,
} from './InterpolationMode';

/**
 * String or chroma-js color.
 */
export type ColorInput = string | Color;

export type ColorPaletteConfig = RequireExactlyOne<{
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

export interface RandomColorConfig
    extends Pick<RandomPaletteConfig, 'minBrightness'> {}

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
    private readonly maxNumberOfColors = 8;
    private readonly deltaEThreshold: number;

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
     */
    static random({
        nColors,
        ...config
    }: Omit<ColorPaletteConfig, 'colors' | 'normalizedColors'> & {
        nColors: number;
    }) {
        return new ColorPalette({
            ...config,
            colors: Array.from({ length: nColors }, () => chroma.random()),
        });
    }

    constructor({
        colors,
        mode,
        nSteps,
        normalizedColors,
        deltaEThreshold,
    }: ColorPaletteConfig) {
        this.mode = mode;
        this.nSteps = nSteps;
        this.colors = normalizedColors ?? ColorPalette.normalizeColors(colors);

        // Don't count the duplicate color at the end of the wheel
        this.nColors = this.colors.length - 1;

        this.hexes = this.colors.map((c) => c.hex());
        this.key = this.hexes.join(':');

        this.scale = chroma
            .scale(this.colors)
            .mode(mode)
            .domain([0, nSteps])
            .out(null);
        const scaleColors = this.scale.colors(nSteps + 1).map((c) => chroma(c));
        scaleColors.pop();
        this.scaleColors = scaleColors;
        this.deltaEThreshold = deltaEThreshold ?? 20;
    }

    /**
     * Creates a new palette with the specified configuration.
     */
    newConfig({
        colors,
        nSteps,
        mode,
    }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
    }) {
        const modeIsSame = mode === this.mode;
        const nStepsIsSame = nSteps === this.nSteps;

        if (modeIsSame && nStepsIsSame) {
            return this.newColors(colors);
        }

        const { key, normalizedColors } = ColorPalette.analyzeColors(colors);
        const colorsAreSame = key === this.key;

        if (nStepsIsSame && colorsAreSame) {
            return this.newMode(mode);
        }

        return new ColorPalette({
            mode,
            nSteps,
            normalizedColors,
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
            mode: this.mode,
            nSteps: this.nSteps,
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
            colors: this.colors,
            mode,
            nSteps: this.nSteps,
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
     *
     * @param seed The color to start with.
     * @param options Options for randomizing the palette.
     * @returns A new palette with randomized colors.
     */
    randomizeFrom(
        seed: ColorInput,
        { nColors = this.nColors, minBrightness = 0 }: RandomPaletteConfig = {},
    ) {
        const colors = [seed];

        let lastColor = seed;
        let attempts = 0;
        while (colors.length < this.nColors && attempts < 10) {
            const possibleColor = chroma.random();
            if (
                chroma.deltaE(lastColor, possibleColor, 1, 1, 1) >
                    this.deltaEThreshold &&
                possibleColor.get('hsv.v') > minBrightness
            ) {
                colors.push(possibleColor);
                lastColor = possibleColor;
            }
            attempts += 1;
        }
        while (colors.length < nColors) {
            colors.push(chroma.random());
        }

        return this.newColors(colors);
    }

    /**
     * Randomizes the whole palette.
     */
    randomize({
        minBrightness = 0,
        nColors = Math.floor(Math.random() * 3 + 3),
    }: RandomPaletteConfig = {}) {
        return this.randomizeFrom(chroma.random(), { nColors, minBrightness });
    }

    /**
     * Adds the specified color.
     */
    push(color: ColorInput) {
        if (this.nColors >= this.maxNumberOfColors) {
            return this;
        }

        return this.newColors(this.colors.concat(chroma(color)));
    }

    private getNewRandomColor({ minBrightness = 0 }: RandomColorConfig = {}) {
        let possibleColor = chroma.random();
        const lastColor = this.colors[this.nColors - 1] as Color;
        let attempts = 0;
        while (
            attempts < 10 &&
            (chroma.deltaE(lastColor, possibleColor, 1, 1, 1) <
                this.deltaEThreshold ||
                possibleColor.get('hsv.v') < minBrightness)
        ) {
            possibleColor = chroma.random();
            attempts += 1;
        }
        return possibleColor;
    }

    /**
     * Adds a random color.
     */
    pushRandom(randomColorConfig: RandomColorConfig = {}) {
        return this.push(this.getNewRandomColor(randomColorConfig));
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
        return this.rotateOn(this.getNewRandomColor(options));
    }
}
