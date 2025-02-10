import chroma, { Color } from 'chroma-js';
import { SubscriptionManager } from 'scrips';
import {
    ColorInput,
    ColorPalette,
    RandomColorConfig,
    RandomPaletteConfig,
} from './ColorPalette';
import { InterpolationMode, InterpolationModes } from './InterpolationMode';
import { clamp } from './clamp';
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
    /**
     * Max number of colors in the palette.
     * Defaults to 8.
     */
    maxNumberOfColors?: number;
};

export interface ColorUpdateConfig {
    /**
     * The speed of the transition between two palettes.
     * Should be between 0 and 1. Will be clamped to this range.
     * Defaults to 0.1.
     * The higher the value, the faster the transition.
     */
    transitionSpeed?: number;
}

export interface ThemeUpdateEvent {
    /**
     * The current color palette.
     */
    palette: Readonly<ColorPalette>;
    /**
     * The current colors in the wheel (palette and intermediate colors).
     */
    colors: Color[];
    /**
     * The current interpolation mode.
     */
    mode: InterpolationMode;
    /**
     * The current brightness factor (0-1).
     */
    brightness: number;
}

export type ThemeUpdateCallback = (event: ThemeUpdateEvent) => void;

/**
 * A dynamic color theme that can be updated and transitioned between different color palettes.
 */
export class Theme {
    /**
     * The number of steps in the color scale.
     * Defaults to 2048.
     */
    readonly nSteps: number;
    /**
     * Max number of colors allowed in the theme's palettes.
     * Defaults to 8.
     */
    readonly maxNumberOfColors: number;
    /**
     * The active palette to use for color generation.
     */
    palette: ColorPalette;
    /**
     * The target palette to transition to.
     */
    targetPalette?: ColorPalette;
    /**
     * The global brightness factor.
     */
    private _brightness = 1;
    /**
     * The interpolation mode to use between colors in the palette.
     */
    mode: InterpolationMode;
    private transitionSpeed = 0;
    private iColor = 0;
    private previousColorDistance?: number;
    private readonly colorDistanceThreshold = 0.001;
    private colors: Color[];
    private readonly scrips = new SubscriptionManager<ThemeUpdateEvent>();

    constructor(config?: ThemeConfig) {
        this.nSteps = config?.nSteps ?? 2048;
        this.mode = config?.mode ?? InterpolationModes.rgb;
        this.maxNumberOfColors = config?.maxNumberOfColors ?? 8;

        const initialPalette =
            config && 'palette' in config ? config.palette : undefined;

        if (initialPalette) {
            this.palette = new ColorPalette({
                colors: initialPalette.colors,
                mode: config?.mode ?? initialPalette.mode,
                nSteps: this.nSteps,
                deltaEThreshold: config?.deltaEThreshold,
                maxNumberOfColors: this.maxNumberOfColors,
            });
            this.mode = this.palette.mode;
        } else {
            const initialColors =
                config && 'colors' in config ? config.colors : undefined;
            if (initialColors) {
                this.palette = new ColorPalette({
                    colors: initialColors,
                    mode: this.mode,
                    nSteps: this.nSteps,
                    deltaEThreshold: config?.deltaEThreshold,
                    maxNumberOfColors: this.maxNumberOfColors,
                });
            } else {
                const nColors =
                    (config && 'nColors' in config
                        ? config.nColors
                        : undefined) ?? 5;
                this.palette = new ColorPalette({
                    colors: Array.from({ length: nColors }, () =>
                        chroma.random(),
                    ),
                    mode: this.mode,
                    nSteps: this.nSteps,
                    deltaEThreshold: config?.deltaEThreshold,
                    maxNumberOfColors: this.maxNumberOfColors,
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

    /**
     * The average distance between the colors in the current and target palettes.
     * Measured in CIEDE2000 color distance.
     * Ranges from 0 (identical) to 100 (maximally different).
     * Returns undefined if there is no target palette.
     */
    get transitionDistance() {
        return this.previousColorDistance;
    }

    private get scale() {
        return this.palette.scale;
    }

    /**
     * The active palette to use for color generation.
     */
    get activePalette(): Readonly<ColorPalette> {
        return this.targetPalette ?? this.palette;
    }

    /**
     * The hex values of the colors in the active palette.
     */
    get activePaletteHexes() {
        const hexes = this.activePalette.hexes.slice();
        hexes.pop();
        return hexes;
    }

    /**
     * The relative brightness of the theme.
     * 0 is the darkest, 1 is the brightest.
     */
    get brightness() {
        return this._brightness;
    }

    /**
     * Set the relative brightness of the theme.
     * 0 is the darkest, 1 is the brightest.
     */
    set brightness(brightness: number) {
        this._brightness = clamp(brightness, 0, 1);
    }

    private getBaseColor(index = 0) {
        const baseColor = this.colors[this.normalizeIndex(index)] as Color;
        if (this._brightness === 1) {
            return baseColor;
        }
        return baseColor.darken(mapBrightnessToDarkenFactor(this._brightness));
    }

    /**
     * The average distance between the colors in the current and target palettes.
     * Measured in CIEDE2000 color distance.
     * Ranges from 0 (identical) to 100 (maximally different).
     * Returns undefined if there is no target palette.
     */
    private calculateAverageTargetDistance() {
        if (!this.targetPalette) {
            return undefined;
        }
        const targetColors = this.targetPalette.scaleColors;
        const colorDistances = targetColors.map((color, iColor) =>
            chroma.deltaE(color, this.colors[iColor] as Color, 1, 1, 1),
        );
        return (
            colorDistances.reduce((sum, d) => sum + d, 0) /
            colorDistances.length
        );
    }

    /**
     * Subscribe to get updates when the theme changes.
     * Callbacks will receive a ThemeUpdateEvent.
     * @returns An event object with the current theme status.
     */
    subscribe(callback: ThemeUpdateCallback): ThemeUpdateEvent {
        this.scrips.subscribe(callback);
        return this.status;
    }

    /**
     * Unsubscribe a given callback from theme updates.
     */
    unsubscribe(callback: ThemeUpdateCallback): void {
        this.scrips.unsubscribe(callback);
    }

    private get status(): ThemeUpdateEvent {
        return {
            palette: this.activePalette,
            colors: this.activePalette.scaleColors,
            mode: this.mode,
            brightness: this.brightness,
        };
    }

    /**
     * Publish the current theme status to all subscribers.
     */
    private publish() {
        this.scrips.publish(this.status);
    }

    /**
     * Get the color at the given index in the theme.
     * @param index The index of the color to get.
     * @param options Options for the color generation.
     * @param options.brightness Optionally adjust the brightness of the color. 0-1, defaults to 1.
     * @returns The color at the given index.
     */
    getColor(index = 0, { brightness = 1 }: { brightness?: number } = {}) {
        const color = this.getBaseColor(index);
        if (brightness >= 1) {
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
        this.transitionSpeed = clamp(transitionSpeed, 0, 1) / 10;
        if (this.targetPalette) {
            this.palette = targetPalette;
        }
        this.targetPalette = targetPalette;
        this.publish();
    }

    /**
     * Update the theme to a new set of colors, steps, and interpolation mode.
     */
    update({
        colors,
        mode,
        ...options
    }: {
        colors: ColorInput[];
        mode: InterpolationMode;
    } & ColorUpdateConfig) {
        this.updateScale(
            this.activePalette.newConfig({
                colors,
                nSteps: this.nSteps,
                mode,
                maxNumberOfColors: this.maxNumberOfColors,
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
        this.updateScale(
            this.activePalette.newColors(
                ColorPalette.clampColors(colorInputs, this.maxNumberOfColors),
            ),
            options,
        );
    }

    /**
     * Randomize the colors of the theme based on a seed color.
     * Defaults to the same number of colors as the current palette.
     * Max number of colors defined in the theme config is respected.
     */
    randomFrom(
        color: ColorInput,
        {
            minBrightness = 0,
            nColors = this.activePalette.nColors,
            ...options
        }: ColorUpdateConfig & RandomPaletteConfig = {},
    ) {
        this.updateScale(
            this.activePalette.randomizeFrom(color, {
                minBrightness,
                nColors: Math.min(nColors, this.maxNumberOfColors),
            }),
            options,
        );
    }

    /**
     * Randomize the colors of the theme.
     * Defaults to the same number of colors as the current palette.
     * Max number of colors defined in the theme config is respected.
     */
    randomTheme({
        minBrightness = 0,
        nColors = this.activePalette.nColors,
        ...options
    }: ColorUpdateConfig & RandomPaletteConfig = {}) {
        this.updateScale(
            this.activePalette.randomize({
                minBrightness,
                nColors: Math.min(nColors, this.maxNumberOfColors),
            }),
            options,
        );
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
    pushRandomColor({
        minBrightness,
        ...options
    }: ColorUpdateConfig & RandomColorConfig = {}) {
        this.updateScale(
            this.activePalette.pushRandom({
                minBrightness,
            }),
            options,
        );
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
    rotateRandomColor({
        minBrightness,
        ...options
    }: ColorUpdateConfig & RandomColorConfig = {}) {
        this.updateScale(
            this.activePalette.rotateRandomOn({
                minBrightness,
            }),
            options,
        );
    }

    private clearTargetPalette() {
        this.targetPalette = undefined;
        this.previousColorDistance = undefined;
        this.publish();
    }

    private transitionPalette() {
        if (!this.targetPalette) {
            return;
        }

        if (this.targetPalette === this.palette) {
            // Transition complete
            this.clearTargetPalette();
            return;
        }

        const averageColorDistance = this.calculateAverageTargetDistance();
        if (!averageColorDistance) {
            return;
        }

        if (
            this.previousColorDistance !== undefined &&
            Math.abs(this.previousColorDistance - averageColorDistance) <
                this.colorDistanceThreshold
        ) {
            // Transition complete
            this.palette = this.targetPalette;
            this.colors = this.palette.scaleColors;
            this.clearTargetPalette();
            return;
        }

        const targetColors = this.targetPalette.scaleColors;
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

    /**
     * Move the color index by n steps.
     * Can be negative to move backwards.
     *
     * Also updates the color palette slightly to transition to the new palette,
     * if a target palette is set. This is not affected by the n parameter.
     */
    tick(n = 1) {
        this.transitionPalette();

        this.iColor += n;
    }
}
