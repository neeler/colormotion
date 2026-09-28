import chroma, { Color, Scale } from 'chroma-js';
import {
    InterpolationMode,
    InterpolationModes,
    getNextInterpolationMode,
} from './InterpolationMode';
import type { ColorConstraints } from './constraints';
import {
    budgetOf,
    constraintAt,
    drawAwayFrom,
    drawColor,
    startRound,
} from './draw';
import { sampleScale } from './interpolate';
import { sameOrder } from './sameOrder';

/**
 * String or chroma-js color.
 */
export type ColorInput = string | Color;

/**
 * A function returning a pseudo-random number in the range [0, 1),
 * like Math.random. Supply your own to get reproducible palettes.
 */
export type RandomFunction = () => number;

/**
 * Default minimum CIEDE2000 distance between a random color and the colors it is drawn away from: the
 * color before it in a random palette or when pushed, and both of its neighbours when rotated in.
 */
export const DEFAULT_DELTA_E_THRESHOLD = 20;

/**
 * Default maximum number of colors in a palette.
 */
export const DEFAULT_MAX_NUMBER_OF_COLORS = 8;

/**
 * Exactly one of `colors` or `normalizedColors` must be provided.
 */
export type ColorPaletteColors =
    | {
          /**
           * The colors to use in the palette.
           * Their order is also their age order: the first is the oldest (see ColorPalette.ageOrder).
           */
          colors: ColorInput[];
          normalizedColors?: never;
      }
    | {
          colors?: never;
          /**
           * The normalized colors to use in the palette.
           * Don't use this unless you know what you're doing.
           * As with colors, their order is their age order.
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
    /**
     * Random number generator used when generating random colors.
     * Defaults to Math.random.
     */
    random?: RandomFunction;
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
    /**
     * Limits on the random colors' OKLCH hue and relative chroma (see ColorConstraint): one constraint for
     * every color, or a list with one for each position in the palette (a missing entry counts as {}).
     * Each method says which position a color it draws takes.
     * Given (even {}), the colors are drawn in OKLCH, as randomColor draws them with a constraint. Left out,
     * they are drawn in HSV exactly as in 4.0, so a seeded random draws the colors it drew then.
     */
    constraints?: ColorConstraints;
    /**
     * The most candidates the method looks at beyond the first of each color it keeps deltaEThreshold from its
     * neighbours (three calls to random each): shared evenly by those colors in the order they are drawn, a
     * color passing what it does not use to the colors after it (see RandomLikeOptions.candidateBudget). A
     * color never looks at more than 100, so a budget of 99 or more for each such color changes nothing,
     * unless no candidate's distance is a number (a NaN minBrightness without constraints, say): the first
     * candidate is then kept, where without a budget a 101st is drawn. Left out (or NaN), up to 100
     * candidates each, as in 4.2.
     */
    candidateBudget?: number;
}

export interface RandomColorConfig extends Pick<
    RandomPaletteConfig,
    'minBrightness' | 'constraints' | 'candidateBudget'
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
    /**
     * chroma-js's scale over the palette colors. The palette's own colors (scaleColors, and so a Theme's)
     * follow chroma's interpolation except near hue-less ends, where colormotion's mix reaches the end and
     * chroma's stops short: toward black in LCH, HCL and OKLCH, and toward white in HSI. And in OKLCH,
     * where chroma's mix reads a translucent color's alpha as its hue, they mix translucent colors as the
     * opaque ones, with alpha mixed on its own.
     * The scale mixes when it is called, under chroma's Lab white point at the time.
     */
    readonly scale: Scale;
    /**
     * The colors of the wheel, one per step, sampled from the scale once, when the palette is built.
     * Mixing in lab, lch, hcl, oklab and oklch depends on chroma's Lab white point (see
     * chroma.setLabWhitePoint), and these keep the one set then: changing it later does not change them.
     * newColors, newMode and newConfig return this same palette when its colors, mode and settings would
     * not change, and build any other palette they return under the white point set at the time.
     */
    readonly scaleColors: Color[];
    readonly maxNumberOfColors: number;
    readonly deltaEThreshold: number;
    readonly random: RandomFunction;
    /** Backs ageOrder: frozen, so palettes can share it. */
    private _ageOrder: readonly number[];

    /**
     * Normalizes the input colors to chroma-js colors.
     */
    static normalizeColors(colorInputs: ColorInput[]) {
        const colors = colorInputs.map(ColorPalette.normalizeColor);

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

    /**
     * A chroma-js color for the input. chroma's oklch and oklab constructors leave alpha undefined (NaN):
     * such a color is opaque.
     */
    private static normalizeColor(value: ColorInput) {
        const color = chroma(value);
        return Number.isNaN(color.alpha()) ? color.alpha(1) : color;
    }

    static clampColors(colors: ColorInput[], maxNumberOfColors: number) {
        if (colors.length <= maxNumberOfColors) {
            return colors;
        }

        return colors.slice(0, maxNumberOfColors);
    }

    /**
     * Normalized colors cut to their first maxNumberOfColors, still closing the wheel. The cut comes after
     * normalizing, so a cut list that happens to end on the first color keeps it as a color of its own.
     * (Such a palette's hexes, given back as colors, normalize to one color fewer.)
     */
    private static cropColors(colors: Color[], maxNumberOfColors: number) {
        if (colors.length > maxNumberOfColors + 1) {
            return ColorPalette.normalizeColors(
                ColorPalette.clampColors(colors, maxNumberOfColors).concat(
                    colors[0]!,
                ),
            );
        }
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
     * Defaults to 5 colors.
     * Each color after the first is drawn at least deltaEThreshold (CIEDE2000) from the one before it.
     * The color at position i meets constraints[i] (or the one constraint given for every color).
     * With a candidateBudget, the colors after the first share it (see RandomPaletteConfig.candidateBudget).
     */
    static random({
        nColors = 5,
        minBrightness = 0,
        constraints,
        candidateBudget,
        ...config
    }: Omit<ColorPaletteConfig, 'colors' | 'normalizedColors'> &
        RandomPaletteConfig) {
        const random = config.random ?? Math.random;
        const deltaEThreshold =
            config.deltaEThreshold ?? DEFAULT_DELTA_E_THRESHOLD;
        const budget = budgetOf(candidateBudget);
        if (budget) {
            // shared by the colors after the first, each kept from the one before it: the loop below draws
            // ceil(nColors) − 1 of them
            startRound(budget, Math.ceil(nColors) - 1);
        }

        let lastColor = drawColor(
            constraintAt(constraints, 0),
            random,
            minBrightness,
        );
        const colors = [lastColor];

        while (colors.length < nColors) {
            const nextColor = drawAwayFrom([lastColor], {
                minBrightness,
                deltaEThreshold,
                random,
                constraint: constraintAt(constraints, colors.length),
                budget,
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
        random = Math.random,
    }: ColorPaletteConfig) {
        this.mode = mode;
        this.nSteps = nSteps;
        this.maxNumberOfColors = maxNumberOfColors;
        this.deltaEThreshold = deltaEThreshold;
        this.random = random;
        this.colors = ColorPalette.cropColors(
            normalizedColors ?? ColorPalette.normalizeColors(colors),
            maxNumberOfColors,
        );

        // Don't count the duplicate color at the end of the wheel
        this.nColors = this.colors.length - 1;
        // a list's order is its age order (derived palettes set their own)
        this._ageOrder = Object.freeze(
            Array.from({ length: this.nColors }, (_, i) => i),
        );

        this.hexes = this.colors.map((c) => c.hex());
        this.key = this.hexes.join(':');

        this.scale = chroma
            .scale(this.colors)
            .mode(mode)
            .domain([0, nSteps])
            .out(null);
        // chroma's scale cache keys on floor(t * 10000), which would
        // collapse adjacent steps for large nSteps. Each step is only
        // sampled once anyway.
        this.scale.cache(false);
        // chroma.scale duplicates a single color. In OKLCH, where its mix
        // would read a translucent color's alpha as the hue, the duplicate
        // is sampled here instead.
        const stops =
            this.colors.length === 1 && mode === 'oklch'
                ? [this.colors[0]!, this.colors[0]!]
                : this.colors;
        if (
            Number.isFinite(nSteps) &&
            nSteps > 0 &&
            stops.length > 1 &&
            Object.prototype.hasOwnProperty.call(InterpolationModes, mode)
        ) {
            // The samples scale.colors would take, converting each palette
            // color once and mixing with colormotion's rules. chroma.scale
            // still samples step counts of 0 or less, single colors outside
            // OKLCH, and modes outside InterpolationModes.
            this.scaleColors = sampleScale(stops, mode, nSteps);
        } else {
            // Request Color objects directly rather than hex strings,
            // which would quantize the scale to 8 bits per channel.
            const scaleColors = this.scale.colors(nSteps + 1, null);
            scaleColors.pop();
            this.scaleColors = scaleColors;
        }
    }

    /**
     * The positions of the palette's colors (indexes into colors and hexes), oldest first: the order in
     * which rotations replace them. rotateOn and rotateRandomOn replace the color at ageOrder[0] in its
     * position, which moves to the end; popOldest drops the color at ageOrder[0]; push adds its new
     * position at the end. So the next rotations replace ageOrder[0], ageOrder[1] and so on, in turn.
     *
     * A palette built from a list (the constructor, newColors, newConfig with other colors, randomize,
     * randomizeFrom and ColorPalette.random) takes the list order: the first color is the oldest, so its
     * rotations go first in, first out. newMode, rotateMode and newConfig with the same colors keep the
     * ages, and so does any method that gives back this palette. The array is frozen.
     */
    get ageOrder(): readonly number[] {
        return this._ageOrder;
    }

    /**
     * A palette of these colors, in these positions and with these ages (positions, oldest first), with this
     * palette's settings and the given mode. The colors are used as they are: unlike a list given to the
     * constructor, a last color equal to the first is not taken for the closing repeat and dropped.
     * Gives back this palette when the colors, ages and mode are all this palette's.
     */
    private derive(
        colors: Color[],
        ageOrder: readonly number[],
        mode = this.mode,
    ) {
        const palette = new ColorPalette({
            ...this.derivedConfig,
            mode,
            normalizedColors: colors.concat(colors[0]!),
        });
        palette.inheritAgeOrder(ageOrder);
        if (
            palette.key === this.key &&
            palette.mode === this.mode &&
            sameOrder(palette._ageOrder, this._ageOrder)
        ) {
            return this;
        }
        return palette;
    }

    /**
     * Sets the ages of a palette just built from colors whose ages are known, keeping the positions the
     * constructor kept if it cut the colors to maxNumberOfColors.
     */
    private inheritAgeOrder(ageOrder: readonly number[]) {
        this._ageOrder = Object.freeze(
            ageOrder.length > this.nColors
                ? ageOrder.filter((position) => position < this.nColors)
                : ageOrder,
        );
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
            random: this.random,
        };
    }

    /**
     * Creates a new palette with the specified configuration.
     * Options not provided are inherited from this palette.
     * The same colors keep their positions and ages (a lower maxNumberOfColors keeps those of the colors it
     * keeps); other colors take their list order as their age order, as in newColors.
     */
    newConfig({
        colors,
        nSteps,
        mode,
        maxNumberOfColors = this.maxNumberOfColors,
        deltaEThreshold = this.deltaEThreshold,
        random = this.random,
    }: {
        colors: ColorInput[];
        mode: InterpolationMode;
        nSteps: number;
        maxNumberOfColors?: number;
        deltaEThreshold?: number;
        random?: RandomFunction;
    }) {
        const modeIsSame = mode === this.mode;
        const nStepsIsSame = nSteps === this.nSteps;
        const settingsAreSame =
            maxNumberOfColors === this.maxNumberOfColors &&
            deltaEThreshold === this.deltaEThreshold &&
            random === this.random;

        if (modeIsSame && nStepsIsSame && settingsAreSame) {
            return this.newColors(colors);
        }

        const { key, normalizedColors } = ColorPalette.analyzeColors(colors);
        const colorsAreSame = key === this.key;

        if (nStepsIsSame && colorsAreSame && settingsAreSame) {
            return this.newMode(mode);
        }

        const palette = new ColorPalette({
            mode,
            nSteps,
            normalizedColors,
            maxNumberOfColors,
            deltaEThreshold,
            random,
        });
        if (colorsAreSame) {
            palette.inheritAgeOrder(this._ageOrder);
        }
        return palette;
    }

    /**
     * Gets a new palette with new colors but the same mode.
     * The list order is the new colors' age order: the first is the oldest (see ageOrder), so new colors
     * start the rotation order again from the first.
     * The same colors, or a longer list whose first colors are the ones this palette keeps, give back this
     * palette, ages included.
     */
    newColors(colors: ColorInput[]) {
        const { key, normalizedColors } = ColorPalette.analyzeColors(colors);

        // the same colors change nothing, and so does a longer list that starts with the colors this
        // palette keeps (the constructor makes the cut)
        if (
            key === this.key ||
            ColorPalette.cropColors(normalizedColors, this.maxNumberOfColors)
                .map((c) => c.hex())
                .join(':') === this.key
        ) {
            return this;
        }

        return new ColorPalette({
            ...this.derivedConfig,
            normalizedColors,
        });
    }

    /**
     * Gets a new palette with the same colors, in the same positions and with the same ages, but a different
     * mode.
     */
    newMode(mode: InterpolationMode) {
        if (mode === this.mode) {
            return this;
        }

        return this.derive(
            this.colors.slice(0, this.nColors),
            this._ageOrder,
            mode,
        );
    }

    /**
     * Gets a new palette with the same colors and ages but the next mode.
     */
    rotateMode() {
        return this.newMode(getNextInterpolationMode(this.mode));
    }

    /**
     * Randomizes the palette starting with the input color.
     * Maintains the number of colors in the palette.
     * Each random color is drawn at least deltaEThreshold (CIEDE2000) from the one before it.
     *
     * @param seed The color to start with, at position 0. It is kept as it is (it meets no constraint), lifted
     * to minBrightness if it is darker.
     * @param options Options for randomizing the palette. The random color at position i (from 1) meets
     * constraints[i] (or the one constraint given for every color). With a candidateBudget, the random colors
     * share it (see RandomPaletteConfig.candidateBudget).
     * @returns A new palette with randomized colors.
     */
    randomizeFrom(
        seed: ColorInput,
        {
            nColors = this.nColors,
            minBrightness = 0,
            constraints,
            candidateBudget,
        }: RandomPaletteConfig = {},
    ) {
        const budget = budgetOf(candidateBudget);
        if (budget) {
            // shared by the colors after the seed: the loop below draws ceil(nColors) − 1 of them
            startRound(budget, Math.ceil(nColors) - 1);
        }
        let lastColor = chroma(seed);
        if (lastColor.get('hsv.v') < minBrightness) {
            lastColor = lastColor.set('hsv.v', minBrightness);
        }
        const colors = [lastColor];

        while (colors.length < nColors) {
            const nextColor = drawAwayFrom([lastColor], {
                minBrightness,
                deltaEThreshold: this.deltaEThreshold,
                random: this.random,
                constraint: constraintAt(constraints, colors.length),
                budget,
            });
            colors.push(nextColor);
            lastColor = nextColor;
        }

        return this.newColors(colors);
    }

    /**
     * Randomizes the whole palette.
     * Maintains the number of colors in the palette.
     * Draws the first color, then the others as randomizeFrom does. The color at position i meets
     * constraints[i] (or the one constraint given for every color). With a candidateBudget, the colors after
     * the first share it, as in randomizeFrom.
     */
    randomize({
        minBrightness = 0,
        nColors = this.nColors,
        constraints,
        candidateBudget,
    }: RandomPaletteConfig = {}) {
        return this.randomizeFrom(
            drawColor(constraintAt(constraints, 0), this.random, minBrightness),
            { nColors, minBrightness, constraints, candidateBudget },
        );
    }

    /**
     * Adds the color at the end, as the newest (the last position in ageOrder). Gives back this palette if
     * it already has maxNumberOfColors colors.
     */
    push(color: ColorInput) {
        if (this.nColors >= this.maxNumberOfColors) {
            return this;
        }

        return this.derive(
            this.colors
                .slice(0, this.nColors)
                .concat(ColorPalette.normalizeColor(color)),
            this._ageOrder.concat(this.nColors),
        );
    }

    /**
     * Adds a random color at the end, as push does, drawn at least deltaEThreshold (CIEDE2000) from the
     * current last color. The new color meets constraints[nColors], the constraint for the position it takes
     * (or the one constraint given for every color). With a candidateBudget, no more than 1 + candidateBudget
     * candidates are looked at (never more than 100).
     */
    pushRandom(randomColorConfig: RandomColorConfig = {}) {
        const { constraints, candidateBudget, ...config } = randomColorConfig;
        return this.push(
            drawAwayFrom([this.colors[this.nColors - 1]!], {
                deltaEThreshold: this.deltaEThreshold,
                random: this.random,
                ...config,
                constraint: constraintAt(constraints, this.nColors),
                budget: budgetOf(candidateBudget),
            }),
        );
    }

    /**
     * Drops the oldest color (the one at ageOrder[0]). The others keep their order and their ages, closing
     * up the gap. Gives back this palette if it has only one color.
     */
    popOldest() {
        if (this.nColors < 2) {
            return this;
        }

        const oldest = this._ageOrder[0]!;
        const colors = this.colors.slice(0, this.nColors);
        colors.splice(oldest, 1);
        return this.derive(
            colors,
            this._ageOrder
                .slice(1)
                .map((position) =>
                    position > oldest ? position - 1 : position,
                ),
        );
    }

    /**
     * Replaces the oldest color (the one at ageOrder[0]) with the color, in its position, and makes the new
     * color the newest. Every other color keeps its position, so the scale changes only between the
     * replaced color's two neighbours around the wheel (for the first color, the last color and the
     * second). Successive rotations of a palette built from a list replace its colors in list order: first
     * in, first out. Replacing the oldest color with the same color still makes it the newest; only a
     * single color replaced by itself gives back this palette.
     *
     * To shift the colors instead, as rotateOn did before 4.0 (dropping the first color and appending the
     * new one, so every color moves one position): newColors([...hexes.slice(1, -1), color]).
     */
    rotateOn(color: ColorInput) {
        const oldest = this._ageOrder[0]!;
        const colors = this.colors.slice(0, this.nColors);
        colors[oldest] = ColorPalette.normalizeColor(color);
        return this.derive(colors, this._ageOrder.slice(1).concat(oldest));
    }

    /**
     * Replaces the oldest color with a random color, as rotateOn does. The new color is drawn at least
     * deltaEThreshold (CIEDE2000) from both of the colors it will sit between around the wheel: in a
     * palette of two, the other color, and in a palette of one, the color it replaces. If no candidate
     * qualifies within a bounded number of draws, the one furthest from the nearer of them is used.
     * The new color meets constraints[ageOrder[0]], the constraint for the position it replaces (or the one
     * constraint given for every color), so the colors a palette of picks rotates in stay near each pick.
     * With a candidateBudget, no more than 1 + candidateBudget candidates are looked at (never more than 100).
     *
     * To shift the colors instead, as rotateRandomOn did before 4.0 (dropping the first color and appending
     * a random color drawn deltaEThreshold from the last): popOldest().pushRandom(options). With the same
     * random, it draws the same colors as before 4.0, for a palette of two or more colors whose ages are
     * in list order (as they are when its colors are only ever set from lists, pushed or popped). A single
     * color gains a second.
     */
    rotateRandomOn(options?: RandomColorConfig) {
        const { constraints, candidateBudget, ...config } = options ?? {};
        const n = this.nColors;
        const oldest = this._ageOrder[0]!;
        const previous = this.colors[(oldest + n - 1) % n]!;
        const next = this.colors[(oldest + 1) % n]!;
        return this.rotateOn(
            drawAwayFrom(previous === next ? [previous] : [previous, next], {
                deltaEThreshold: this.deltaEThreshold,
                random: this.random,
                ...config,
                constraint: constraintAt(constraints, oldest),
                budget: budgetOf(candidateBudget),
            }),
        );
    }
}
