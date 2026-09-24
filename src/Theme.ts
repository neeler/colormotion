import chroma, { Color } from 'chroma-js';
import { SubscriptionManager } from 'scrips';
import {
    ColorInput,
    ColorPalette,
    DEFAULT_MAX_NUMBER_OF_COLORS,
    RandomColorConfig,
    RandomFunction,
    RandomPaletteConfig,
} from './ColorPalette';
import { InterpolationMode, InterpolationModes } from './InterpolationMode';
import { clamp } from './clamp';
import { ModeCoords, mixCoords, toModeCoords } from './interpolate';
import { mapBrightnessToDarkenFactor } from './mapBrightnessToDarkenFactor';
import { safeMod } from './safeMod';

/**
 * Maximum number of scale colors sampled when estimating the distance to the
 * target palette during a transition.
 */
const MAX_DISTANCE_SAMPLES = 128;

/**
 * Transition speed used when none is given (or it is NaN).
 */
const DEFAULT_TRANSITION_SPEED = 0.1;

/**
 * A transitionDuration within this fraction of a whole number of ticks (relative to it) counts as that whole number,
 * so float products such as 1.1 * 50 (55.00000000000001) end on the tick they name.
 */
const WHOLE_TICK_TOLERANCE = 1e-9;

/**
 * 3x² − 2x³: eases in and out, starting and ending at rest.
 */
function smoothstep(x: number) {
    return x * x * (3 - 2 * x);
}

/**
 * A transitionDuration in ticks: undefined unless it is a finite number, 0 for "now", and otherwise
 * the duration, snapped to a whole number when within WHOLE_TICK_TOLERANCE of one.
 */
function normalizeDuration(duration: number | undefined) {
    if (duration === undefined || !Number.isFinite(duration)) {
        return undefined;
    }
    if (duration <= 0) {
        return 0;
    }
    const whole = Math.round(duration);
    return Math.abs(duration - whole) <= whole * WHOLE_TICK_TOLERANCE
        ? whole
        : duration;
}

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
          /**
           * The minimum brightness for the random colors.
           * Scale from 0 to 1.
           * Defaults to 0.
           */
          minBrightness?: number;
      };

/**
 * Supported brightness modes.
 */
export const BrightnessModes = {
    /**
     * Darkens colors in CIELAB space. Colors keep some luminance at brightness 0.
     */
    darken: 'darken',
    /**
     * Scales the RGB channels linearly. Brightness 0 is black (LEDs off)
     * and 0.5 is half output.
     */
    linear: 'linear',
} as const;

export type BrightnessMode =
    (typeof BrightnessModes)[keyof typeof BrightnessModes];

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
    /**
     * Random number generator used when generating random colors.
     * Supply a seeded generator for reproducible palettes.
     * Defaults to Math.random.
     */
    random?: RandomFunction;
    /**
     * How brightness is applied to colors.
     * 'darken' (the default) darkens in CIELAB space, so colors keep some
     * luminance even at brightness 0. 'linear' scales the RGB channels, so
     * brightness 0 is black and 0.5 is half output.
     */
    brightnessMode?: BrightnessMode;
};

export interface ColorUpdateConfig {
    /**
     * The speed of the transition between two palettes.
     * Should be between 0 and 1. Will be clamped to this range.
     * Defaults to 0.1.
     * NaN is treated as not given.
     * The higher the value, the faster the transition.
     * A speed of 0 makes no progress, so the transition is treated as
     * settled and the target palette is applied on the second tick.
     * Ignored when transitionDuration is a finite number.
     * An update to the palette the theme is already transitioning to does not
     * change the transition's speed.
     */
    transitionSpeed?: number;
    /**
     * How many ticks the transition takes, instead of a transitionSpeed.
     * A tick is one call to tick(), whatever its n: 6 * 60 is 6 seconds when
     * tick() is called 60 times a second.
     *
     * The colors ease in and out (smoothstep) from where they are, and become
     * exactly the target palette on the last tick. A fractional duration ends
     * on the next whole tick (2.5 ends on tick 3), and a value within one part
     * in a billion of a whole number counts as that number (1.1 * 50 ends on
     * tick 55). 0 or less applies the palette before the call returns,
     * notifying subscribers once, with isTransitioning false. Anything that is
     * not a finite number is ignored, and transitionSpeed applies instead.
     *
     * For the palette the theme is already transitioning to (including a call
     * that leaves it unchanged, such as pushing a color onto a full palette):
     * - The same duration changes nothing and keeps the current end, so an
     *   update can safely be re-sent every tick.
     * - A different duration re-times the transition to end that many ticks
     *   from now, continuing from the current colors without notifying
     *   subscribers. The easing starts again from rest, so re-send the same
     *   duration rather than a countdown of the ticks left.
     * - 0 or less finishes the transition.
     */
    transitionDuration?: number;
}

export interface ThemeUpdateEvent {
    /**
     * The current color palette.
     */
    palette: Readonly<ColorPalette>;
    /**
     * Is the theme transitioning between palettes.
     */
    isTransitioning: boolean;
    /**
     * The colors in the wheel of the active palette (the target palette
     * while transitioning): the palette colors and the interpolated colors
     * between them.
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
     * How brightness is applied to colors.
     * Defaults to 'darken'.
     */
    readonly brightnessMode: BrightnessMode;
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
    /**
     * The scale colors at rest, and where the current transition started from.
     */
    private colors: Color[];
    /**
     * How far the current transition has come, 0-1. Mixing a fraction `speed` of the way to the
     * target on every tick lands at 1 - (1 - speed)^ticks, so a transition is one mix from its start
     * colors at this progress: no per-tick pass over every color. A timed transition sets it along
     * smoothstep instead.
     */
    private progress = 0;
    /** 1 - progress; a running product during a transitionSpeed transition. */
    private remaining = 1;
    /** Start and target colors in the mode's coordinates, converted once, on first use. */
    private fromCoords: (ModeCoords | undefined)[] = [];
    private toCoords: (ModeCoords | undefined)[] = [];
    /** Colors mixed at the current progress, built on first use. */
    private mixed: (Color | undefined)[] = [];
    /** The tick each entry in `mixed` was built on. */
    private mixedTick = new Int32Array(0);
    private tickCount = 0;
    /** Ticks a timed transition takes; undefined at rest or for a transitionSpeed transition. */
    private durationTicks?: number;
    /** Ticks since the timed transition started or was re-timed. */
    private elapsedTicks = 0;
    /** Progress when the timed transition was re-timed; 0 for a new target. */
    private progressBase = 0;
    /** transitionDistance during a timed transition, measured when read, and the tick it was measured on. */
    private measuredDistance?: number;
    private measuredDistanceTick = -1;
    /**
     * Indexes of the scale colors sampled when measuring the distance to the target palette.
     */
    private readonly sampleIndexes: number[];
    private readonly scrips = new SubscriptionManager<ThemeUpdateEvent>();

    constructor(config?: ThemeConfig) {
        this.nSteps = config?.nSteps ?? 2048;
        this.mode = config?.mode ?? InterpolationModes.rgb;
        this.brightnessMode = config?.brightnessMode ?? BrightnessModes.darken;

        const initialPalette =
            config && 'palette' in config ? config.palette : undefined;

        const random = config?.random ?? initialPalette?.random;

        this.maxNumberOfColors =
            config?.maxNumberOfColors ??
            initialPalette?.maxNumberOfColors ??
            DEFAULT_MAX_NUMBER_OF_COLORS;
        const deltaEThreshold =
            config?.deltaEThreshold ?? initialPalette?.deltaEThreshold;

        if (initialPalette) {
            this.palette = new ColorPalette({
                colors: initialPalette.colors,
                mode: config?.mode ?? initialPalette.mode,
                nSteps: this.nSteps,
                deltaEThreshold,
                maxNumberOfColors: this.maxNumberOfColors,
                random,
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
                    deltaEThreshold,
                    maxNumberOfColors: this.maxNumberOfColors,
                    random,
                });
            } else {
                const nColors =
                    (config && 'nColors' in config
                        ? config.nColors
                        : undefined) ?? 5;
                const minBrightness =
                    config && 'minBrightness' in config
                        ? config.minBrightness
                        : 0;
                this.palette = ColorPalette.random({
                    mode: this.mode,
                    nSteps: this.nSteps,
                    deltaEThreshold,
                    maxNumberOfColors: this.maxNumberOfColors,
                    random,
                    minBrightness,
                    nColors,
                });
            }
        }

        this.colors = this.palette.scaleColors;
        this.sampleIndexes = Theme.getSampleIndexes(this.nSteps);
    }

    /**
     * Evenly spaced indexes used to estimate the distance to the target palette.
     * Sampling at most 128 of the scale colors keeps the per-tick cost low
     * while tracking the full average closely.
     */
    private static getSampleIndexes(nSteps: number) {
        const nSamples = Math.max(1, Math.min(nSteps, MAX_DISTANCE_SAMPLES));
        const indexes: number[] = [];
        for (let i = 0; i < nSamples; i++) {
            indexes.push(Math.floor((i * nSteps) / nSamples));
        }
        return indexes;
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
     * Estimated from an evenly spaced sample of the scale colors.
     * Returns undefined if there is no target palette.
     * During a transitionSpeed transition, this is the distance measured at the
     * start of the last tick, and undefined until the first tick after the
     * target changed. During a transitionDuration transition, it is measured
     * from the current colors when read.
     */
    get transitionDistance() {
        const targetPalette = this.targetPalette;
        if (targetPalette && this.durationTicks !== undefined) {
            if (this.measuredDistanceTick !== this.tickCount) {
                this.measuredDistance =
                    this.calculateAverageTargetDistance(targetPalette);
                this.measuredDistanceTick = this.tickCount;
            }
            return this.measuredDistance;
        }
        return this.previousColorDistance;
    }

    /**
     * Whether the theme is transitioning to a target palette.
     */
    get isTransitioning() {
        return this.targetPalette !== undefined;
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
     * Subscribers are notified when the value changes.
     * NaN is ignored.
     */
    set brightness(brightness: number) {
        const nextBrightness = clamp(brightness, 0, 1);
        if (
            Number.isNaN(nextBrightness) ||
            nextBrightness === this._brightness
        ) {
            return;
        }
        this._brightness = nextBrightness;
        this.publish();
    }

    /**
     * Applies a brightness factor (0-1) to a color according to the theme's brightness mode.
     */
    private applyBrightness(color: Color, brightness: number) {
        // written so NaN also counts as full brightness
        if (!(brightness < 1)) {
            return color;
        }
        if (this.brightnessMode === BrightnessModes.linear) {
            const factor = Math.max(brightness, 0);
            const [r, g, b] = color.rgb(false);
            return chroma.rgb(r * factor, g * factor, b * factor);
        }
        return color.darken(mapBrightnessToDarkenFactor(brightness));
    }

    private getBaseColor(index = 0) {
        return this.applyBrightness(
            this.currentColor(this.normalizeIndex(index)),
            this._brightness,
        );
    }

    /**
     * The scale color at an index right now: at rest, or mixed at the transition's progress.
     */
    private currentColor(index: number): Color {
        const targetPalette = this.targetPalette;
        if (!targetPalette || this.progress === 0) {
            return this.colors[index] as Color;
        }
        if (this.mixedTick[index] === this.tickCount) {
            return this.mixed[index] as Color;
        }
        const from = this.colors[index] as Color;
        const to = targetPalette.scaleColors[index] as Color;
        const color = mixCoords(
            (this.fromCoords[index] ??= toModeCoords(from, this.mode)),
            (this.toCoords[index] ??= toModeCoords(to, this.mode)),
            this.progress,
            this.mode,
            from.alpha(),
            to.alpha(),
        );
        this.mixed[index] = color;
        this.mixedTick[index] = this.tickCount;
        return color;
    }

    /**
     * The average distance between the current colors and the target palette's colors.
     * Measured in CIEDE2000 color distance.
     * Ranges from 0 (identical) to 100 (maximally different).
     * Estimated from an evenly spaced sample of the scale colors.
     */
    private calculateAverageTargetDistance(targetPalette: ColorPalette) {
        const targetColors = targetPalette.scaleColors;
        let sum = 0;
        for (const iColor of this.sampleIndexes) {
            sum += chroma.deltaE(
                targetColors[iColor] as Color,
                this.currentColor(iColor),
                1,
                1,
                1,
            );
        }
        return sum / this.sampleIndexes.length;
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
            isTransitioning: Boolean(this.targetPalette),
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
     * @param options.brightness Optionally adjust the brightness of the color. 0-1, defaults to 1. NaN counts as 1.
     * @returns The color at the given index.
     */
    getColor(index = 0, { brightness = 1 }: { brightness?: number } = {}) {
        return this.applyBrightness(this.getBaseColor(index), brightness);
    }

    /**
     * Update the theme to a new set of colors.
     *
     * transitionSpeed should be between (0,1)
     */
    private updateScale(
        targetPalette: ColorPalette,
        {
            transitionSpeed = DEFAULT_TRANSITION_SPEED,
            transitionDuration,
        }: ColorUpdateConfig = {},
    ) {
        if (targetPalette === this.palette) {
            return;
        }
        const duration = normalizeDuration(transitionDuration);
        if (targetPalette === this.targetPalette) {
            if (duration === undefined || duration === this.durationTicks) {
                return;
            }
            if (duration === 0) {
                this.completeTransition(targetPalette);
                return;
            }
            // re-time from where the colors are: progress, start colors and caches stay, so nothing moves now
            this.progressBase = this.progress;
            this.elapsedTicks = 0;
            this.durationTicks = duration;
            return;
        }
        if (duration === 0) {
            // nothing to mix: adopt the palette now, even mid-transition
            this.mode = targetPalette.mode;
            this.completeTransition(targetPalette);
            return;
        }
        // a new target mid-transition starts from wherever the colors are now
        if (this.targetPalette) {
            this.colors = Array.from({ length: this.nSteps }, (_, i) =>
                this.currentColor(i),
            );
        }
        this.mode = targetPalette.mode;
        const speed = clamp(transitionSpeed, 0, 1);
        this.transitionSpeed =
            (Number.isNaN(speed) ? DEFAULT_TRANSITION_SPEED : speed) / 10;
        this.durationTicks = duration;
        this.elapsedTicks = 0;
        this.progressBase = 0;
        this.targetPalette = targetPalette;
        this.previousColorDistance = undefined;
        this.resetMixing();
        this.publish();
    }

    /**
     * Update the theme to a new set of colors and, optionally, interpolation mode.
     * The mode defaults to the current mode.
     */
    update({
        colors,
        mode = this.mode,
        ...options
    }: {
        colors: ColorInput[];
        mode?: InterpolationMode;
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
     * An index that is not a finite number (NaN, Infinity) counts as 0.
     */
    normalizeIndex(index = 0) {
        // the wheel position is fractional after a fractional tick(n); colors are read at the nearest step
        const position = Math.round(this.iColor);
        const normalized = safeMod(Math.round(index) + position, this.nSteps);
        return Number.isNaN(normalized)
            ? safeMod(position, this.nSteps)
            : normalized;
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

    /**
     * Finish the current transition now: the target palette is applied exactly,
     * and subscribers are notified as when a transition ends on its own.
     * Works for transitionSpeed and transitionDuration transitions alike.
     * Does nothing when the theme is not transitioning.
     */
    finishTransition() {
        const targetPalette = this.targetPalette;
        if (targetPalette) {
            this.completeTransition(targetPalette);
        }
    }

    /**
     * Finish the transition by adopting the target palette.
     */
    private completeTransition(targetPalette: ColorPalette) {
        this.palette = targetPalette;
        this.colors = targetPalette.scaleColors;
        this.targetPalette = undefined;
        this.previousColorDistance = undefined;
        this.durationTicks = undefined;
        this.elapsedTicks = 0;
        this.progressBase = 0;
        this.resetMixing();
        this.publish();
    }

    /**
     * Start mixing from progress 0, dropping cached coordinates and colors.
     */
    private resetMixing() {
        this.progress = 0;
        this.remaining = 1;
        this.fromCoords = [];
        this.toCoords = [];
        this.mixed = [];
        if (this.mixedTick.length !== this.nSteps) {
            this.mixedTick = new Int32Array(this.nSteps);
        }
        this.tickCount++;
    }

    private transitionPalette() {
        const targetPalette = this.targetPalette;
        if (!targetPalette) {
            return;
        }

        const duration = this.durationTicks;
        if (duration !== undefined) {
            // a timed transition ends on its last tick, however much or little is left to see
            const elapsed = ++this.elapsedTicks;
            if (elapsed >= duration) {
                this.completeTransition(targetPalette);
                return;
            }
            const base = this.progressBase;
            this.progress = base + (1 - base) * smoothstep(elapsed / duration);
            this.remaining = 1 - this.progress;
            this.tickCount++;
            return;
        }

        const averageColorDistance =
            this.calculateAverageTargetDistance(targetPalette);

        // Already there (or no measurable distance, e.g. a mode change on a
        // single-color palette): finish immediately rather than waiting for a
        // change in distance that will never come.
        const isNegligible = !(
            averageColorDistance > this.colorDistanceThreshold
        );
        // The distance has stopped changing: the remaining difference is
        // imperceptible, so snap to the target.
        const hasSettled =
            this.previousColorDistance !== undefined &&
            Math.abs(this.previousColorDistance - averageColorDistance) <
                this.colorDistanceThreshold;

        if (isNegligible || hasSettled) {
            this.completeTransition(targetPalette);
            return;
        }

        this.previousColorDistance = averageColorDistance;
        this.remaining *= 1 - this.transitionSpeed;
        this.progress = 1 - this.remaining;
        this.tickCount++;
    }

    /**
     * Move the color index by n steps.
     * Can be negative to move backwards.
     * Can be fractional: fractions add up, and colors are read at the nearest whole step.
     *
     * Also advances the transition to the target palette by one tick, if one is
     * set. This is not affected by the n parameter, so tick(0) advances a
     * transition without rotating the wheel.
     * An n that is not a finite number (NaN, Infinity) does not move the index.
     */
    tick(n = 1) {
        this.transitionPalette();

        const iColor = safeMod(this.iColor + n, this.nSteps);
        if (!Number.isNaN(iColor)) {
            this.iColor = iColor;
        }
    }
}
