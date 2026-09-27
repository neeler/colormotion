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
import { darkenScale, isD65WhitePoint } from './convert';
import {
    ModeCoords,
    mixCoords,
    mixScaleRgb,
    scaleCoords,
    toModeCoords,
} from './interpolate';
import { mapBrightnessToDarkenFactor } from './mapBrightnessToDarkenFactor';
import { safeMod } from './safeMod';
import { sameOrder } from './sameOrder';

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
 * A transitionSpeed transition snaps to its target once its colors stop changing, but only when they are
 * within this average CIEDE2000 distance of it: about half of the smallest difference the eye can see.
 * The average is over the sampled colors the transition changes (see Theme.settleIndexes), so a change to
 * part of the wheel, such as a rotation, is not diluted by the colors it leaves alone.
 * Stopping is not enough by itself: the distance can hold steady or rise before it falls, most often in
 * hue-based modes.
 */
const SETTLED_DISTANCE = 0.5;

/**
 * A backstop: a transitionSpeed transition also snaps to its target once this little of the mix is left
 * (99.9999 % done), whatever the distance, in case its colors ever stop short of the target. colormotion's
 * mixing reaches its ends in every mode, and a transition that does is within SETTLED_DISTANCE well before
 * this, even in lrgb, where the distance falls only with the square root of what is left.
 */
const SETTLED_REMAINING = 1e-6;

/**
 * A transitionDuration within this fraction of a whole number of ticks (relative to it) counts as that whole number,
 * so float products such as 1.1 * 50 (55.00000000000001) end on the tick they name.
 */
const WHOLE_TICK_TOLERANCE = 1e-9;

/** chroma.getLabWhitePoint, looked up once rather than on every getColor during a transition. */
const getLabWhitePoint = chroma.getLabWhitePoint;

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
           * The theme uses a copy of the palette with the theme's nSteps and any mode, maxNumberOfColors,
           * deltaEThreshold or random option given in place of the palette's (the palette itself when none
           * of them differs). The copy keeps the colors' positions and ages (see ColorPalette.ageOrder).
           */
          palette?: ColorPalette;
      }
    | {
          /**
           * The initial colors in the palette.
           * Their order is also their age order: rotations replace them from the first (see
           * ColorPalette.ageOrder).
           */
          colors?: ColorInput[];
      }
    | {
          /**
           * The initial number of colors in the palette.
           * N random colors will be generated if neither palette nor colors is provided,
           * up to maxNumberOfColors.
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
     * Darkens colors in CIELAB space, lowering the lightness by up to 54 (of 100) at brightness 0.
     * Colors lighter than lightness 54 keep some light at brightness 0 (white becomes #6d6d6d), and
     * many saturated colors keep a dim tint (#0000ff becomes #000069); mid and dark greys and dark,
     * muted colors reach black.
     * Colors are darkened as they are read, under chroma's Lab white point at the time.
     */
    darken: 'darken',
    /**
     * Scales the RGB channels linearly. Brightness 0 is black (LEDs off)
     * and 0.5 halves every channel.
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
     * Defaults to the palette option's mode if one is given, and to RGB otherwise.
     */
    mode?: InterpolationMode;
    /**
     * The minimum threshold for the CIEDE2000 color distance between colors in the palette.
     * Defaults to the palette option's deltaEThreshold if one is given, and to 20 otherwise.
     */
    deltaEThreshold?: number;
    /**
     * Max number of colors in the palette.
     * Defaults to the palette option's maxNumberOfColors if one is given, and to 8 otherwise.
     */
    maxNumberOfColors?: number;
    /**
     * Random number generator used when generating random colors.
     * Supply a seeded generator for reproducible palettes.
     * Defaults to the palette option's random if one is given, and to Math.random otherwise.
     */
    random?: RandomFunction;
    /**
     * How brightness is applied to colors.
     * 'darken' (the default) darkens in CIELAB space, so light and saturated
     * colors can keep some light even at brightness 0 (white becomes #6d6d6d).
     * 'linear' scales the RGB channels, so brightness 0 is black and 0.5
     * halves every channel.
     */
    brightnessMode?: BrightnessMode;
};

export interface ColorUpdateConfig {
    /**
     * The speed of the transition between two palettes.
     * Should be between 0 and 1. Will be clamped to this range.
     * Defaults to 0.1.
     * NaN is treated as not given.
     * The higher the value, the faster the transition: a typical palette
     * change takes about 45 / speed ticks (0.1: about 10 s at 60 ticks a
     * second; 0.01: about 75 s; 0.001: about 12 minutes). For an exact
     * length, use transitionDuration.
     * The transition ends once the colors stop changing within 0.5 CIEDE2000
     * of the target, averaged over a sample of the scale colors that the
     * transition changes (single colors can be a little further off), or
     * once 99.9999 % of the mix is done. A change to part of the wheel, such
     * as a rotation, ends as smoothly as a whole new palette.
     * A speed of 0 makes no progress, so the transition is treated as
     * settled and the target palette is applied on the second tick. The same
     * goes for a speed too small to move the colors at all (about 5e-16 or
     * less).
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
     * that leaves it unchanged, such as pushing a color onto a full palette,
     * or one that changes only the ages of its colors, such as rotating in
     * the color the oldest already has):
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
     * The active palette: the target palette while transitioning.
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
 * Options for Theme.fillRgb.
 */
export interface FillRgbOptions {
    /**
     * Adjusts the brightness of every color, as getColor's brightness option does: it compounds with the
     * theme's brightness, in the theme's brightnessMode.
     * 0-1, defaults to 1. NaN counts as 1.
     */
    brightness?: number;
    /**
     * Where in the array the first value goes.
     * A whole number, 0 or more. Defaults to 0.
     */
    offset?: number;
    /**
     * The value a channel at full intensity is written as.
     * Defaults to 1, for values from 0 to 1. 255 writes chroma-js's 0-255 channel values, the ones
     * getColor(i).rgb(false) returns (unrounded).
     * Anything that is not a finite number above 0 counts as 1.
     */
    max?: number;
}

/** An array fillRgb can write into. */
type FillTarget = Float32Array | Float64Array | number[];

/**
 * fillRgb's darkened colors (sRGB, 0-255), and what they were darkened from and by: a buffer of scale
 * colors, the tick it was read on, and the darken factors applied (-1 for none).
 */
interface DarkenedRgb {
    rgb: Float64Array;
    from?: Float64Array;
    tick: number;
    themeAmount: number;
    amount: number;
}

/** A DarkenedRgb for colors of this many channels, holding none yet. */
function emptyDarkenedRgb(length: number): DarkenedRgb {
    return {
        rgb: new Float64Array(length),
        tick: -1,
        themeAmount: -1,
        amount: -1,
    };
}

/**
 * Whether cache holds the colors in from, as of tick, darkened by these factors. If not, it is keyed to
 * them, for the caller to darken them into cache.rgb.
 */
function isDarkened(
    cache: DarkenedRgb,
    from: Float64Array,
    tick: number,
    themeAmount: number,
    amount: number,
) {
    if (
        cache.from === from &&
        cache.tick === tick &&
        cache.themeAmount === themeAmount &&
        cache.amount === amount
    ) {
        return true;
    }
    cache.from = from;
    cache.tick = tick;
    cache.themeAmount = themeAmount;
    cache.amount = amount;
    return false;
}

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
     * Defaults to the palette option's maxNumberOfColors if one is given, and to 8 otherwise.
     */
    readonly maxNumberOfColors: number;
    /**
     * How brightness is applied to the colors getColor returns.
     * Defaults to 'darken'.
     */
    readonly brightnessMode: BrightnessMode;
    /** Backs palette, which resyncs the theme when assigned. */
    private _palette: ColorPalette;
    /** Backs targetPalette, which starts or cancels a transition when assigned. */
    private _targetPalette?: ColorPalette;
    /**
     * The global brightness factor.
     */
    private _brightness = 1;
    /** Backs mode, which transitions to the new mode when assigned. */
    private _mode: InterpolationMode;
    private transitionSpeed = 0;
    private iColor = 0;
    /** transitionDistance during a transitionSpeed transition: the average over every sampled color. */
    private previousColorDistance?: number;
    /** The distance the transitionSpeed transition settles on, measured at the start of the last tick. */
    private previousSettleDistance?: number;
    /**
     * The sampled indexes a transitionSpeed transition settles on: those whose colors start more than
     * colorDistanceThreshold from the target's, found on its first tick (all of them if none does).
     * Averaging over the colors it leaves alone would let a change to part of the wheel snap to its
     * target while the colors it changes are still visibly off.
     */
    private settleIndexes?: readonly number[];
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
    /** Counts ticks, and every other change that leaves the colors mixed on this tick stale. */
    private tickCount = 0;
    /**
     * chroma's Lab white point (chroma.getLabWhitePoint()) that the cached coordinates and colors were read
     * under: lab, lch, hcl, oklab and oklch coordinates depend on it.
     */
    private labWhitePoint: string = getLabWhitePoint();
    /** Ticks a timed transition takes; undefined at rest or for a transitionSpeed transition. */
    private durationTicks?: number;
    /** Ticks since the timed transition started or was re-timed. */
    private elapsedTicks = 0;
    /** Progress when the timed transition was re-timed; 0 for a new target. */
    private progressBase = 0;
    /** transitionDistance during a timed transition, measured when read, and the tick it was measured on. */
    private measuredDistance?: number;
    private measuredDistanceTick = -1;
    /** fillRgb's scale colors mixed at the current progress (sRGB, 0-255), and the tick they were mixed on. */
    private fillMixed?: Float64Array;
    private fillMixedTick = -1;
    /**
     * fillRgb's colors in 'darken' mode: darkened by the theme's brightness, and then by the brightness
     * option. See darkenedRgb.
     */
    private fillThemeDarkened?: DarkenedRgb;
    private fillDarkened?: DarkenedRgb;
    /**
     * Indexes of the scale colors sampled when measuring the distance to the target palette.
     */
    private readonly sampleIndexes: number[];
    private readonly scrips = new SubscriptionManager<ThemeUpdateEvent>();
    /**
     * The copies adopt made of assigned palettes, so assigning the same palette again, for example on
     * every frame, doesn't rebuild it, and chroma's Lab white point when each was made: a copy mixes its
     * scale colors as it is built, so it is built again under another white point.
     */
    private readonly adoptedCopies = new WeakMap<
        ColorPalette,
        { copy: ColorPalette; labWhitePoint: string }
    >();

    constructor(config?: ThemeConfig) {
        this.nSteps = config?.nSteps ?? 2048;
        this._mode = config?.mode ?? InterpolationModes.rgb;
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
            // newConfig keeps the colors' positions and ages
            this._palette = initialPalette.newConfig({
                colors: initialPalette.colors,
                mode: config?.mode ?? initialPalette.mode,
                nSteps: this.nSteps,
                deltaEThreshold,
                maxNumberOfColors: this.maxNumberOfColors,
                random,
            });
            this._mode = this._palette.mode;
        } else {
            const initialColors =
                config && 'colors' in config ? config.colors : undefined;
            if (initialColors) {
                this._palette = new ColorPalette({
                    colors: initialColors,
                    mode: this._mode,
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
                this._palette = ColorPalette.random({
                    mode: this._mode,
                    nSteps: this.nSteps,
                    deltaEThreshold,
                    maxNumberOfColors: this.maxNumberOfColors,
                    random,
                    minBrightness,
                    nColors,
                });
            }
        }

        this.colors = this._palette.scaleColors;
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

    /**
     * Creates a theme with a palette of nColors random colors: the same as new Theme(config), with
     * nColors required. A palette or colors option takes precedence over nColors.
     */
    static random(
        config: ThemeConfig & {
            nColors: number;
        },
    ) {
        return new Theme(config);
    }

    /**
     * The palette the theme was last at rest on: the initial palette, the one most recently assigned,
     * or the target of the most recent transition that finished (cancelling a transition leaves it
     * unchanged). It does not change during a transition, when the colors are a mix that getColor
     * returns.
     */
    get palette(): ColorPalette {
        return this._palette;
    }

    /**
     * Puts the theme at rest on the palette at once, ending any transition, and notifies subscribers:
     * the same as update with the palette's colors and mode and a transitionDuration of 0, except that
     * the palette's deltaEThreshold, random and color ages (ageOrder) are kept. Assigning the palette the
     * theme is already at rest on changes nothing, and so does a palette with the same colors, settings
     * and ages; one that differs only in its ages takes its place, so the next rotations follow the
     * assigned ages. A palette with a different nSteps or maxNumberOfColors from the theme's is rebuilt
     * with the theme's, as the constructor does, so reading palette back gives that copy.
     */
    set palette(palette: ColorPalette) {
        const adopted = this.adopt(palette);
        if (adopted === this._palette && !this._targetPalette) {
            return;
        }
        this._mode = adopted.mode;
        this.completeTransition(adopted);
    }

    /**
     * The palette the theme is transitioning to, or undefined when it is not transitioning.
     */
    get targetPalette(): ColorPalette | undefined {
        return this._targetPalette;
    }

    /**
     * Transitions to the palette at the default speed, as update does, from wherever the colors are;
     * the palette it is already heading to changes nothing, and the palette it is at rest on changes
     * nothing either (nor does a palette with the same colors, settings and ages as either). A palette
     * with the colors and settings of the active palette but other ages takes its place without a
     * transition: only the order of the next rotations changes, so the theme stays at rest, or its
     * transition keeps going as it was. A palette with a different nSteps or maxNumberOfColors from the
     * theme's is rebuilt with the theme's. So reading targetPalette back does not always give the palette
     * assigned: it can be a copy, or undefined when the theme stays at rest.
     * undefined cancels a transition: the theme returns to palette, and mode to its mode, at once, and
     * notifies subscribers (finishTransition ends it at the target instead).
     */
    set targetPalette(palette: ColorPalette | undefined) {
        if (palette) {
            this.updateScale(this.adopt(palette));
        } else if (this._targetPalette) {
            this._mode = this._palette.mode;
            this.completeTransition(this._palette);
        }
    }

    /**
     * The interpolation mode of the active palette (the target palette while transitioning): the
     * mode in which transitions mix colors, and the one update uses when no mode is given.
     */
    get mode(): InterpolationMode {
        return this._mode;
    }

    /**
     * Transitions to the active palette in this mode at the default speed: the same as setMode.
     */
    set mode(mode: InterpolationMode) {
        this.setMode(mode);
    }

    /**
     * An assigned palette as the theme holds it: a copy with the theme's nSteps and maxNumberOfColors if
     * it has others (as the constructor makes of a palette option), which keeps its colors' positions and
     * ages, or the palette the theme is on or heading to if it has the same colors, settings and ages, so
     * assigning an equal palette changes nothing.
     */
    private adopt(palette: ColorPalette): ColorPalette {
        let adopted = palette;
        if (
            palette.nSteps !== this.nSteps ||
            palette.maxNumberOfColors !== this.maxNumberOfColors
        ) {
            const labWhitePoint: string = getLabWhitePoint();
            const cached = this.adoptedCopies.get(palette);
            if (cached?.labWhitePoint === labWhitePoint) {
                adopted = cached.copy;
            } else {
                // newConfig keeps the colors' positions and ages
                adopted = palette.newConfig({
                    colors: palette.colors,
                    mode: palette.mode,
                    nSteps: this.nSteps,
                    maxNumberOfColors: this.maxNumberOfColors,
                });
                this.adoptedCopies.set(palette, {
                    copy: adopted,
                    labWhitePoint,
                });
            }
        }
        for (const own of [this._targetPalette, this._palette]) {
            if (
                own &&
                Theme.haveSameColors(own, adopted) &&
                sameOrder(own.ageOrder, adopted.ageOrder)
            ) {
                return own;
            }
        }
        return adopted;
    }

    /**
     * Whether two palettes have the same colors (by hex, as update compares them) and settings, whatever
     * the ages of their colors.
     */
    private static haveSameColors(a: ColorPalette, b: ColorPalette) {
        return (
            a.key === b.key &&
            a.mode === b.mode &&
            a.nSteps === b.nSteps &&
            a.maxNumberOfColors === b.maxNumberOfColors &&
            a.deltaEThreshold === b.deltaEThreshold &&
            a.random === b.random
        );
    }

    /**
     * Puts a palette with the active palette's colors and settings but other ages in its place, and returns
     * whether it did. Only the order of the next rotations changes, so there is nothing to transition: at
     * rest the theme stays at rest, and a transition keeps its progress, easing and pace.
     */
    private swapAges(palette: ColorPalette) {
        const active = this._targetPalette ?? this._palette;
        if (
            palette === active ||
            !Theme.haveSameColors(palette, active) ||
            sameOrder(palette.ageOrder, active.ageOrder)
        ) {
            return false;
        }
        if (this._targetPalette) {
            // equal hexes can hide differences below 8 bits, so mix toward the new target's own colors
            this._targetPalette = palette;
            this.toCoords = [];
            this.tickCount++;
        } else {
            this._palette = palette;
            this.colors = palette.scaleColors;
        }
        return true;
    }

    /**
     * The average distance between the theme's colors (before brightness) and the target palette's.
     * Measured in CIEDE2000 color distance.
     * Ranges from 0 (identical) to 100 (maximally different).
     * Estimated from an evenly spaced sample of the scale colors.
     * It averages over the whole wheel, so after a change to part of it, such as a rotation, the colors
     * that change are further off than this; a transitionSpeed transition judges when to end by those
     * colors alone.
     * Returns undefined if there is no target palette.
     * During a transitionSpeed transition, this is the distance measured at the
     * start of the most recent tick, before the colors moved (under chroma's Lab
     * white point then), and undefined until the first tick after the target
     * changed. During a transitionDuration
     * transition, it is measured from the current colors when read (once per
     * tick, and again if chroma's Lab white point changes, as CIEDE2000 and
     * the colors depend on it).
     */
    get transitionDistance() {
        const targetPalette = this._targetPalette;
        if (targetPalette && this.durationTicks !== undefined) {
            // in every mode: CIEDE2000 reads the colors in Lab
            this.syncLabWhitePoint();
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
        return this._targetPalette !== undefined;
    }

    /**
     * The palette the theme is at or heading to: targetPalette while transitioning, and palette
     * otherwise. During a transition, getColor returns a mix of the starting colors and this palette.
     */
    get activePalette(): Readonly<ColorPalette> {
        return this._targetPalette ?? this._palette;
    }

    /**
     * The hex values of the colors in the active palette, without the closing repeat of the first.
     *
     * A rotation or a push can leave a palette whose last color matches its first, such as blue, green,
     * blue. Given back as colors (to setColors, update or the constructor), such a list loses its last
     * color, which is taken for the closing repeat. To give a palette's colors back as they are, pass
     * activePalette.hexes, which ends with the closing repeat, or activePalette.colors.
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
            return chroma.rgb(
                r * factor,
                g * factor,
                b * factor,
                color.alpha(),
            );
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
     * The scale color at an index right now: at rest, or mixed at the transition's progress, under
     * chroma's Lab white point as it is now.
     */
    private currentColor(index: number): Color {
        const targetPalette = this._targetPalette;
        if (!targetPalette || this.progress === 0) {
            return this.colors[index] as Color;
        }
        this.syncLabWhitePoint();
        if (this.mixedTick[index] === this.tickCount) {
            return this.mixed[index] as Color;
        }
        const from = this.colors[index] as Color;
        const to = targetPalette.scaleColors[index] as Color;
        const color = mixCoords(
            (this.fromCoords[index] ??= toModeCoords(from, this._mode)),
            (this.toCoords[index] ??= toModeCoords(to, this._mode)),
            this.progress,
            this._mode,
            from.alpha(),
            to.alpha(),
        );
        this.mixed[index] = color;
        this.mixedTick[index] = this.tickCount;
        return color;
    }

    /**
     * The sampled indexes whose colors are more than colorDistanceThreshold from the target's now, or all of
     * them if none is.
     */
    private findChangingSamples(targetColors: Color[]) {
        const changing = this.sampleIndexes.filter(
            (iColor) =>
                chroma.deltaE(
                    targetColors[iColor] as Color,
                    this.currentColor(iColor),
                    1,
                    1,
                    1,
                ) > this.colorDistanceThreshold,
        );
        return changing.length > 0 ? changing : this.sampleIndexes;
    }

    /**
     * The average distance between the current colors and the target palette's colors.
     * Measured in CIEDE2000 color distance.
     * Ranges from 0 (identical) to 100 (maximally different).
     * Estimated from an evenly spaced sample of the scale colors.
     */
    private calculateAverageTargetDistance(targetPalette: ColorPalette) {
        return (
            this.sumTargetDistances(
                targetPalette.scaleColors,
                this.sampleIndexes,
            ) / this.sampleIndexes.length
        );
    }

    /**
     * The sum of the CIEDE2000 distances between the current colors and the target colors at the indexes.
     */
    private sumTargetDistances(
        targetColors: Color[],
        indexes: readonly number[],
    ) {
        let sum = 0;
        for (const iColor of indexes) {
            sum += chroma.deltaE(
                targetColors[iColor] as Color,
                this.currentColor(iColor),
                1,
                1,
                1,
            );
        }
        return sum;
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
            isTransitioning: Boolean(this._targetPalette),
            colors: this.activePalette.scaleColors,
            mode: this._mode,
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
     * During a transition, the color is mixed when read, under chroma's Lab white point as it is then (see
     * chroma.setLabWhitePoint), which mixing in lab, lch, hcl, oklab and oklch depends on. The palettes'
     * own scale colors, which the theme shows at rest, keep the white point each palette was built under.
     * Brightness below 1 in 'darken' mode is applied when read too, in CIELAB under the white point then.
     * @param index The index of the color to get.
     * @param options Options for the color generation.
     * @param options.brightness Optionally adjust the brightness of the color. 0-1, defaults to 1. NaN counts as 1.
     * @returns The color at the given index.
     */
    getColor(index = 0, { brightness = 1 }: { brightness?: number } = {}) {
        return this.applyBrightness(this.getBaseColor(index), brightness);
    }

    /**
     * Writes every color of the scale into an array, as getColor reads them: the red, green and blue values
     * of getColor(i, { brightness }) for each index i from 0 to nSteps - 1, at out[offset + 3 * i],
     * out[offset + 3 * i + 1] and out[offset + 3 * i + 2]. So the wheel position that tick() moves, a
     * transition in progress, and the theme's brightness and brightnessMode apply as they do there: out
     * starts with the color at step normalizeIndex(0). Alpha is not written, and nothing else in out
     * changes.
     *
     * The values are getColor(i, { brightness }).rgb(false) divided by 255, exactly: 0 to 1, for LED
     * pipelines that work in floats. Pass max: 255 for the 0-255 channels themselves. A Float32Array holds
     * them rounded to single precision.
     *
     * Made for filling a lookup table on every frame: it builds no chroma-js Color. At rest, it reads the
     * colors from a buffer kept per palette. During a transition, it mixes them and converts them to sRGB in
     * buffers the theme reuses, once per tick however many times it is called, with arithmetic that mirrors
     * chroma-js's. The first fill after a palette change converts the new colors once. In 'darken' mode, it
     * keeps the colors darkened by the theme's brightness, and those darkened by the most recent brightness
     * option. So a brightness option that changes from one call to the next (a fade, or two lookup tables at
     * different brightnesses) darkens every color again on each call, as every tick of a transition does:
     * about five times as fast as getColor, rather than ten or more.
     *
     * If chroma.setLabWhitePoint has moved chroma-js off its default white point, D65, it reads each color
     * with getColor instead.
     *
     * Throws a RangeError, writing nothing, when offset is not a whole number of 0 or more or out is too
     * short.
     * @param out The array to fill: room for nSteps * 3 values from offset.
     * @param options Options for the fill.
     * @returns out.
     */
    fillRgb<T extends Float32Array | Float64Array | number[]>(
        out: T,
        { brightness = 1, offset = 0, max = 1 }: FillRgbOptions = {},
    ): T {
        const nSteps = this.nSteps;
        // the whole numbers from 0 below nSteps (nSteps itself, for the whole number the constructor expects)
        const count = nSteps > 0 ? Math.ceil(nSteps) : 0;
        if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new RangeError(
                `fillRgb: offset must be a whole number of 0 or more, not ${offset}`,
            );
        }
        if (out.length - offset < count * 3) {
            throw new RangeError(
                `fillRgb: out needs ${count * 3} values from offset ${offset}, and has ${Math.max(out.length - offset, 0)}`,
            );
        }
        // dividing (rather than multiplying by max / 255) keeps max 1 and 255 exact
        const divisor = 255 / (max > 0 && max < Infinity ? max : 1);

        if (count !== nSteps || !isD65WhitePoint()) {
            this.fillFromColors(out, count, brightness, offset, divisor);
            return out;
        }

        let rgb: Float64Array;
        // applyBrightness's linear factors, the theme's then the option's (1 leaves a channel as it is)
        let themeFactor = 1;
        let factor = 1;
        if (this.brightnessMode === BrightnessModes.linear) {
            rgb = this.currentRgb();
            if (this._brightness < 1) {
                themeFactor = Math.max(this._brightness, 0);
            }
            if (brightness < 1) {
                factor = Math.max(brightness, 0);
            }
        } else {
            rgb = this.darkenedRgb(brightness);
        }

        // out's color i is scale step (i + position) mod nSteps: the steps from position on, then those before it
        const position = this.normalizeIndex();
        const next = Theme.copyRgb(
            rgb,
            position * 3,
            nSteps * 3,
            out,
            offset,
            themeFactor,
            factor,
            divisor,
        );
        Theme.copyRgb(
            rgb,
            0,
            position * 3,
            out,
            next,
            themeFactor,
            factor,
            divisor,
        );
        return out;
    }

    /**
     * Copies rgb[from..to) into out from index o, as applyBrightness scales each channel in linear mode
     * (times themeFactor, then times factor), divided by divisor. Returns the index after the last value
     * written.
     */
    private static copyRgb(
        rgb: Float64Array,
        from: number,
        to: number,
        out: FillTarget,
        o: number,
        themeFactor: number,
        factor: number,
        divisor: number,
    ) {
        for (let i = from; i < to; i++) {
            out[o++] = (rgb[i]! * themeFactor * factor) / divisor;
        }
        return o;
    }

    /**
     * fillRgb one color at a time through getColor, for what the buffers don't cover: a Lab white point other
     * than D65, or an nSteps that is not a whole number of 1 or more.
     */
    private fillFromColors(
        out: FillTarget,
        count: number,
        brightness: number,
        offset: number,
        divisor: number,
    ) {
        for (let i = 0, o = offset; i < count; i++, o += 3) {
            const [r, g, b] = this.getColor(i, { brightness }).rgb(false) as [
                number,
                number,
                number,
            ];
            out[o] = r / divisor;
            out[o + 1] = g / divisor;
            out[o + 2] = b / divisor;
        }
    }

    /**
     * The sRGB channels (0-255) of every scale color right now, before brightness, in scale order: what
     * currentColor returns for each step, without building a Color. At rest, and before the first tick of a
     * transition, a buffer kept per list of colors; mid-transition, the colors mixed at the current progress,
     * once per tick.
     */
    private currentRgb(): Float64Array {
        const targetPalette = this._targetPalette;
        if (!targetPalette || this.progress === 0) {
            return scaleCoords(this.colors, InterpolationModes.rgb);
        }
        const mixed = (this.fillMixed ??= new Float64Array(this.nSteps * 3));
        if (this.fillMixedTick !== this.tickCount) {
            mixScaleRgb(
                scaleCoords(this.colors, this._mode),
                scaleCoords(targetPalette.scaleColors, this._mode),
                this.progress,
                this._mode,
                mixed,
            );
            this.fillMixedTick = this.tickCount;
        }
        return mixed;
    }

    /**
     * The sRGB channels (0-255) of every scale color right now, darkened as applyBrightness darkens them in
     * 'darken' mode: by the theme's brightness, then by the given one, each only when below 1. Each of the
     * two darkens keeps its result until what it darkens or its brightness changes, so a theme at rest
     * darkens its colors once, and a brightness option that changes on every call redoes only the second.
     * Only the most recent option is kept: fills that alternate between two redo the second on every call.
     * At rest, the first darken starts from the colors' Lab coordinates, converted once per list of colors
     * (color.darken converts to Lab first), rather than converting their channels back to Lab on every call.
     */
    private darkenedRgb(brightness: number): Float64Array {
        // each brightness's darken factor, or -1 when applyBrightness leaves the color as it is
        const themeAmount =
            this._brightness < 1
                ? mapBrightnessToDarkenFactor(this._brightness)
                : -1;
        const amount =
            brightness < 1 ? mapBrightnessToDarkenFactor(brightness) : -1;
        if (themeAmount < 0 && amount < 0) {
            return this.currentRgb();
        }
        // the colors to darken, which both darkens are keyed on: at rest (as in currentRgb), their Lab
        // coordinates; mid-transition, their channels mixed on this tick
        const isLab = !this._targetPalette || this.progress === 0;
        const from = isLab
            ? scaleCoords(this.colors, InterpolationModes.lab)
            : this.currentRgb();
        const tick = this.tickCount;
        let darkened = from;
        let darkenedIsLab = isLab;
        if (themeAmount >= 0) {
            const cache = (this.fillThemeDarkened ??= emptyDarkenedRgb(
                from.length,
            ));
            if (!isDarkened(cache, from, tick, themeAmount, -1)) {
                darkenScale(from, isLab, themeAmount, cache.rgb);
            }
            darkened = cache.rgb;
            darkenedIsLab = false;
        }
        if (amount >= 0) {
            const cache = (this.fillDarkened ??= emptyDarkenedRgb(from.length));
            if (!isDarkened(cache, from, tick, themeAmount, amount)) {
                darkenScale(darkened, darkenedIsLab, amount, cache.rgb);
            }
            darkened = cache.rgb;
        }
        return darkened;
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
        // a palette that changes only the ages of the active palette's colors (a rotation onto the color the
        // oldest already has) takes its place with no transition, and the rules below then see it as the
        // palette the theme is on or heading to
        const agesChanged = this.swapAges(targetPalette);
        // at rest, the palette the theme is on changes nothing; mid-transition it is a target like
        // any other (only the targetPalette setter passes the palette itself)
        if (targetPalette === this._palette && !this._targetPalette) {
            if (agesChanged) {
                this.publish();
            }
            return;
        }
        const duration = normalizeDuration(transitionDuration);
        if (targetPalette === this._targetPalette) {
            if (duration === 0) {
                this.completeTransition(targetPalette);
                return;
            }
            if (duration !== undefined && duration !== this.durationTicks) {
                // re-time from where the colors are: progress, start colors and caches stay, so nothing
                // moves now
                this.progressBase = this.progress;
                this.elapsedTicks = 0;
                this.durationTicks = duration;
            }
            if (agesChanged) {
                this.publish();
            }
            return;
        }
        if (duration === 0) {
            // nothing to mix: adopt the palette now, even mid-transition
            this._mode = targetPalette.mode;
            this.completeTransition(targetPalette);
            return;
        }
        // a new target mid-transition starts from wherever the colors are now
        if (this._targetPalette) {
            this.colors = Array.from({ length: this.nSteps }, (_, i) =>
                this.currentColor(i),
            );
        }
        this._mode = targetPalette.mode;
        const speed = clamp(transitionSpeed, 0, 1);
        this.transitionSpeed =
            (Number.isNaN(speed) ? DEFAULT_TRANSITION_SPEED : speed) / 10;
        this.durationTicks = duration;
        this.elapsedTicks = 0;
        this.progressBase = 0;
        this._targetPalette = targetPalette;
        this.previousColorDistance = undefined;
        this.previousSettleDistance = undefined;
        this.settleIndexes = undefined;
        this.resetMixing();
        this.publish();
    }

    /**
     * Update the theme to a new set of colors and, optionally, interpolation mode.
     * The mode defaults to the current mode.
     * The list order of new colors is their age order, so rotations start again from the first; the
     * active palette's own colors, given again, keep their ages (see ColorPalette.newConfig).
     */
    update({
        colors,
        mode = this._mode,
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
     * The list order of new colors is their age order, so rotations start again from the first; the
     * active palette's own colors, given again, keep their ages (see ColorPalette.newColors).
     */
    setColors(colorInputs: ColorInput[], options?: ColorUpdateConfig) {
        // the palette cuts the colors to maxNumberOfColors, as the constructor and update do
        this.updateScale(this.activePalette.newColors(colorInputs), options);
    }

    /**
     * Randomize the colors of the theme based on a seed color.
     * Defaults to the same number of colors as the current palette.
     * Max number of colors defined in the theme config is respected.
     * The seed color is the oldest, so rotations start again from it.
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
     * The new colors' order is their age order, so rotations start again from the first.
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
     * The position in the color scale that getColor(index) reads: the index plus the wheel position
     * that tick() moves, each rounded to a whole step, wrapped into the range 0 to nSteps - 1.
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
     * Push a new color to the end of the active palette, as its newest color (see ColorPalette.push),
     * even one that matches the first (see activePaletteHexes).
     * Adds nothing if the palette already has maxNumberOfColors colors.
     */
    pushNewColor(color: ColorInput, options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.push(color), options);
    }

    /**
     * Push a random color to the end of the active palette, as its newest color, drawn at least
     * deltaEThreshold (CIEDE2000) from the current last color (see ColorPalette.pushRandom).
     * Adds nothing if the palette already has maxNumberOfColors colors.
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
     * Drop the oldest color from the active palette: the one at activePalette.ageOrder[0] (see
     * ColorPalette.popOldest). The others keep their order and ages. Does nothing to a single color.
     */
    popOldestColor(options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.popOldest(), options);
    }

    /**
     * Replace the oldest color of the active palette with the new color, in its position, as the newest
     * (see ColorPalette.rotateOn). Every other color keeps its place on the wheel, so only the colors
     * between the replaced color's two neighbours change. Successive calls replace the colors oldest first,
     * in the order of activePalette.ageOrder: for colors set from a list, first in, first out.
     * During a transition, this rotates the target palette, continuing from its ages.
     * Rotating in the color the oldest already has changes only the ages, so it starts no transition:
     * the theme stays at rest, or its transition keeps going as it was (see transitionDuration for the
     * palette the theme is already transitioning to), and subscribers are notified once.
     *
     * To shift the colors instead, as rotateColor did before 4.0 (dropping the first color and appending
     * the new one, so every color moves one place): setColors([...activePaletteHexes.slice(1), color]).
     */
    rotateColor(color: ColorInput, options?: ColorUpdateConfig) {
        this.updateScale(this.activePalette.rotateOn(color), options);
    }

    /**
     * Replace the oldest color of the active palette with a random color, as rotateColor does, drawn at
     * least deltaEThreshold (CIEDE2000) from both of the colors it will sit between on the wheel (see
     * ColorPalette.rotateRandomOn).
     *
     * To shift the colors instead, as rotateRandomColor did before 4.0 (dropping the first color and
     * appending a random color drawn deltaEThreshold from the last):
     * setColors(activePalette.popOldest().pushRandom({ minBrightness }).colors, options). With the same
     * random, it draws the same colors as before 4.0, as long as the colors are only ever set from lists,
     * pushed or popped, so that their ages stay in list order; a single color gains a second.
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
        const targetPalette = this._targetPalette;
        if (targetPalette) {
            this.completeTransition(targetPalette);
        }
    }

    /**
     * Finish the transition by adopting the target palette.
     */
    private completeTransition(targetPalette: ColorPalette) {
        this._palette = targetPalette;
        this.colors = targetPalette.scaleColors;
        this._targetPalette = undefined;
        this.previousColorDistance = undefined;
        this.previousSettleDistance = undefined;
        this.settleIndexes = undefined;
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
        this.labWhitePoint = getLabWhitePoint();
    }

    /**
     * Drops the coordinates, colors and distance cached for the transition if chroma's Lab white point has
     * changed (chroma.setLabWhitePoint) since they were read, so they are read again under the new one.
     * chroma-js reads lab, lch and hcl coordinates relative to it, and oklab and oklch ones too: although
     * OKLab is defined on D65, chroma-js 3 converts to and from it through its Lab white point.
     * One comparison per call while nothing changes.
     */
    private syncLabWhitePoint() {
        const labWhitePoint: string = getLabWhitePoint();
        if (labWhitePoint !== this.labWhitePoint) {
            this.labWhitePoint = labWhitePoint;
            this.fromCoords = [];
            this.toCoords = [];
            // leaves the colors mixed and the distance measured on this tick stale
            this.tickCount++;
        }
    }

    private transitionPalette() {
        const targetPalette = this._targetPalette;
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

        this.stepAtSpeed(targetPalette);
    }

    /**
     * One tick of a transitionSpeed transition: a fraction of the way to the target, or the end of the
     * transition once it has settled.
     */
    private stepAtSpeed(targetPalette: ColorPalette) {
        const targetColors = targetPalette.scaleColors;
        // on the first tick, the colors are still where the transition started
        const settleIndexes = (this.settleIndexes ??=
            this.findChangingSamples(targetColors));
        const sum = this.sumTargetDistances(targetColors, settleIndexes);
        const settleDistance = sum / settleIndexes.length;

        // Already there (or no measurable distance, e.g. a mode change on a
        // single-color palette): finish immediately rather than waiting for a
        // change in distance that will never come.
        const isNegligible = !(settleDistance > this.colorDistanceThreshold);
        // The distance has stopped changing, and what is left is too small to
        // see or the mix is all but done, so snap to the target. A speed that
        // cannot move the colors (0, or so small that 1 - speed rounds to 1)
        // settles regardless, so every transition ends.
        const hasSettled =
            this.previousSettleDistance !== undefined &&
            Math.abs(this.previousSettleDistance - settleDistance) <
                this.colorDistanceThreshold &&
            (settleDistance < SETTLED_DISTANCE ||
                this.remaining < SETTLED_REMAINING ||
                1 - this.transitionSpeed === 1);

        if (isNegligible || hasSettled) {
            this.completeTransition(targetPalette);
            return;
        }

        this.previousSettleDistance = settleDistance;
        // the samples left out are within colorDistanceThreshold of the target, so they add next to nothing
        this.previousColorDistance = sum / this.sampleIndexes.length;
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
