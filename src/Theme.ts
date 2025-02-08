import chroma, { Color } from 'chroma-js';
import { SubscriptionManager } from 'scrips';
import { ColorInput, ColorPalette } from './ColorPalette';
import { InterpolationMode, InterpolationModes } from './InterpolationMode';
import { mapBrightnessToDarkenFactor } from './mapBrightnessToDarkenFactor';
import { safeMod } from './safeMod';

export type InitialThemeColors =
    | {
          /**
           * The initial color palette.
           * Takes precedence over colors and nColors.
           */
          palette?: ColorPalette;
      }
    | {
          /**
           * The initial colors in the palette.
           */
          colors?: ColorInput[];
      }
    | {
          /**
           * The initial number of colors in the palette.
           * N random colors will be generated if colors is not provided.
           * Defaults to 5.
           */
          nColors?: number;
      };

export type ThemeConfig = InitialThemeColors & {
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
     * The minimum threshold for the CIEDE2000 color distance between colors in the palette.
     * Defaults to 20.
     */
    deltaEThreshold?: number;
};

export interface ColorUpdateConfig {
    /**
     * The speed of the transition between two palettes.
     */
    transitionSpeed?: number;
}

/**
 * A dynamic color theme that can be updated and transitioned between different color palettes.
 */
export class Theme {
    readonly nSteps: number;
    /**
     * The active palette to use for color generation.
     */
    palette: ColorPalette;
    /**
     * The target palette to transition to.
     */
    targetPalette?: ColorPalette;
    private _brightness = 255;
    /**
     * The interpolation mode to use between colors in the palette.
     */
    mode: InterpolationMode;
    private transitionSpeed = 0;
    private iColor = 0;
    private previousColorDistance?: number;
    private readonly colorDistanceThreshold = 0.001;
    private colors: Color[];
    private readonly scrips = new SubscriptionManager<Color[]>();

    constructor(config?: ThemeConfig) {
        this.nSteps = config?.nSteps ?? 2048;
        this.mode = config?.mode ?? InterpolationModes.rgb;

        const initialPalette =
            config && 'palette' in config ? config.palette : undefined;

        if (initialPalette) {
            this.palette = initialPalette;
        } else {
            const initialColors =
                config && 'colors' in config ? config.colors : undefined;
            if (initialColors) {
                this.palette = new ColorPalette({
                    colors: initialColors,
                    mode: this.mode,
                    nSteps: this.nSteps,
                    deltaEThreshold: config?.deltaEThreshold,
                });
            } else {
                const nColors =
                    (config && 'nColors' in config
                        ? config.nColors
                        : undefined) ?? 5;
                this.palette = new ColorPalette({
                    normalizedColors: Array.from({ length: nColors }, () =>
                        chroma.random(),
                    ),
                    mode: this.mode,
                    nSteps: this.nSteps,
                    deltaEThreshold: config?.deltaEThreshold,
                });
            }
        }

        this.colors = this.palette.scaleColors;
    }

    static random(
        config: ThemeConfig & {
            nColors: number;
        },
    ) {
        return new Theme(config);
    }

    private get scale() {
        return this.palette.scale;
    }

    /**
     * The active palette to use for color generation.
     */
    get activePalette() {
        return this.targetPalette ?? this.palette;
    }

    /**
     * The hex values of the colors in the active palette.
     */
    get activePaletteHexes() {
        const hexes = this.activePalette.hexes;
        hexes.pop();
        return hexes;
    }

    /**
     * The relative brightness of the theme.
     */
    get brightness() {
        return this._brightness;
    }

    /**
     * Set the relative brightness of the theme.
     */
    set brightness(brightness: number) {
        this._brightness = Math.max(1, Math.min(255, brightness));
    }

    private getBaseColor(index = 0) {
        const baseColor = this.colors[this.normalizeIndex(index)] as Color;
        if (this._brightness === 255) {
            return baseColor;
        }
        return baseColor.darken(mapBrightnessToDarkenFactor(this._brightness));
    }

    /**
     * Subscribe to get updates when the theme changes.
     * Callbacks will receive the array of chroma.js colors in the theme.
     */
    subscribe(callback: (colors: Color[]) => void) {
        return this.scrips.subscribe(callback);
    }

    /**
     * Unsubscribe a given callback from theme updates.
     */
    unsubscribe(callback: (colors: Color[]) => void) {
        return this.scrips.unsubscribe(callback);
    }

    /**
     * Get the color at the given index in the theme.
     * @param index The index of the color to get.
     * @param options Options for the color generation.
     * @param options.brightness Optionally adjust the brightness of the color. 0-255, defaults to 255.
     * @returns The color at the given index.
     */
    getColor(index = 0, { brightness = 255 }: { brightness?: number } = {}) {
        const color = this.getBaseColor(index);
        if (brightness === 255) {
            return color;
        }
        return color.darken(mapBrightnessToDarkenFactor(brightness));
    }

    /**
     * Update the theme to a new set of colors.
     *
     * transitionSpeed should be between (0,1)
     */
    private updateScale(
        targetPalette: ColorPalette,
        { transitionSpeed = 0.1 }: ColorUpdateConfig = {},
    ) {
        if (targetPalette === this.palette) {
            this.clearTargetPalette();
            return;
        }
        if (targetPalette === this.targetPalette) {
            return;
        }
        this.mode = targetPalette.mode;
        this.transitionSpeed = Math.min(1, Math.max(0, transitionSpeed)) / 10;
        this.targetPalette = targetPalette;
        this.scrips.publish(this.targetPalette.colors);
    }

    /**
     * Update the theme to a new set of colors, steps, and interpolation mode.
     */
    update(
        {
            colors,
            nSteps,
            mode,
        }: {
            colors: ColorInput[];
            mode: InterpolationMode;
            nSteps: number;
        },
        options?: ColorUpdateConfig,
    ) {
        this.updateScale(
            this.activePalette.newConfig({
                colors,
                nSteps,
                mode,
            }),
            options,
        );
    }

    /**
     * Set the interpolation mode of the theme.
     */
    setMode(
        mode: InterpolationMode = InterpolationModes.rgb,
        options?: ColorUpdateConfig,
    ) {
        this.updateScale(this.activePalette.newMode(mode), options);
    }

    /**
     * Rotate the interpolation mode of the theme.
     */
    rotateMode(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.rotateMode(), options);
    }

    /**
     * Set the colors of the theme.
     */
    setColors(colorInputs: ColorInput[], options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.newColors(colorInputs), options);
    }

    /**
     * Randomize the colors of the theme based on a seed color.
     */
    randomFrom(
        color: ColorInput,
        {
            minBrightness = 0,
            ...options
        }: ColorUpdateConfig & {
            minBrightness?: number;
        },
    ) {
        this.updateScale(
            this.activePalette.randomizeFrom(color, {
                minBrightness,
            }),
            options,
        );
    }

    /**
     * Randomize the colors of the theme.
     */
    randomTheme(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.randomize(), options);
    }

    /**
     * Get the color at the given index in the theme.
     * Rounds and normalizes the index so that it is within the bounds of the color scale.
     */
    normalizeIndex(index = 0) {
        let normalizedIndex = Math.round(index);
        return (
            safeMod(normalizedIndex + this.iColor, this.nSteps) % this.nSteps
        );
    }

    /**
     * Push a new color to the end of the palette.
     */
    pushNewColor(color: ColorInput, options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.push(color), options);
    }

    /**
     * Push a random color to the end of the palette.
     */
    pushRandomColor(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.pushRandom(), options);
    }

    /**
     * Pop the oldest color from the palette.
     */
    popOldestColor(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.popOldest(), options);
    }

    /**
     * Drops the oldest color and pushes the new color.
     */
    rotateColor(color: ColorInput, options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.rotateOn(color), options);
    }

    /**
     * Drops the oldest color and pushes a random color.
     */
    rotateRandomColor(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.rotateRandomOn(), options);
    }

    private clearTargetPalette() {
        this.targetPalette = undefined;
        this.previousColorDistance = undefined;
    }

    /**
     * Move the color index by n steps.
     * Can be negative to move backwards.
     */
    tick(n = 1) {
        if (this.targetPalette) {
            if (this.targetPalette === this.palette) {
                this.clearTargetPalette();
            } else {
                const targetColors = this.targetPalette.scaleColors;
                const colorDistances = targetColors.map((color, iColor) =>
                    chroma.deltaE(color, this.colors[iColor] as Color, 1, 1, 1),
                );
                const averageColorDistance =
                    colorDistances.reduce((sum, d) => sum + d, 0) /
                    colorDistances.length;
                if (
                    this.previousColorDistance !== undefined &&
                    Math.abs(
                        this.previousColorDistance - averageColorDistance,
                    ) < this.colorDistanceThreshold
                ) {
                    this.palette = this.targetPalette;
                    this.colors = this.palette.scaleColors;
                    this.clearTargetPalette();
                } else {
                    this.previousColorDistance = averageColorDistance;
                    this.colors = this.colors.map((baseColor, iColor) =>
                        chroma(
                            chroma.mix(
                                baseColor,
                                targetColors[iColor] as Color,
                                this.transitionSpeed,
                                this.mode,
                            ),
                        ),
                    );
                }
            }
        }

        this.iColor += n;
    }
}
