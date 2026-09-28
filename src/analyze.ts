import chroma from 'chroma-js';
import type { ColorInput } from './ColorPalette';
import { ColorMeasure, measureColor } from './gamut';
import {
    analyzeOptions,
    chainCenter,
    classifyGroups,
    hueDistance,
    hueOffset,
    link,
    Linked,
    liftColor,
    wrapHue,
} from './hueGroups';

/*
 * The hue relationship of a theme: which of its colors define its hues, how they group, and how the groups
 * sit around the wheel.
 */

/**
 * How a theme's hues relate, from the number of hue groups it has and the gaps between them (see
 * analyzeTheme):
 * - `neutral`: no hue group; every color is a grey, white or black.
 * - `family`: one group, or three packed into less than contrastFrom (a wide analogous run).
 * - `accent`: two groups, less than contrastFrom (90°) apart.
 * - `contrast`: two groups, contrastFrom or more apart.
 * - `bridge`: three groups within half the wheel, spanning contrastFrom or more: the middle one bridges the
 *   two ends.
 * - `pair-accent`: three groups spread wider, two of them less than contrastFrom apart.
 * - `triad`: three groups, every gap contrastFrom or more.
 * - `spectrum`: four groups or more.
 */
export type Relationship =
    | 'neutral'
    | 'family'
    | 'accent'
    | 'contrast'
    | 'bridge'
    | 'pair-accent'
    | 'triad'
    | 'spectrum';

/**
 * Options for analyzeTheme: how colors are measured, and the thresholds of the analysis. A value that is
 * not a finite number counts as not given.
 */
export interface AnalyzeOptions {
    /**
     * Measure the colors as lifted to this brightness (HSV value), as measureColor does: as they show when a
     * theme lifts its colors to a floor. From 0 to 1; defaults to 0.
     */
    minBrightness?: number;
    /**
     * Colors under this relative chroma are neutral: greys, whites and blacks, which take no part in the hue
     * structure. So are colors under brightness 0.02 (black, at a minBrightness of 0). Defaults to 0.12.
     */
    neutralChroma?: number;
    /**
     * Colors at or over this relative chroma are structural: they define the hue groups. Less saturated
     * colors are muted tints and tones that follow the groups. When no color reaches it (a theme of pastels),
     * every color that is not neutral is structural. Defaults to 0.75.
     */
    structuralChroma?: number;
    /** Structural hues closer than this, in degrees, chain into one group. Defaults to 30. */
    familyJoin?: number;
    /**
     * A muted color joins the group of the nearest structural color if that is within this many degrees;
     * muted colors no group takes form groups of their own. Defaults to 45.
     */
    attachWithin?: number;
    /**
     * Two groups less than this many degrees apart are an accent, and this far or further a contrast. It
     * also bounds a bridge's span and a triad's gaps. Defaults to 90.
     */
    contrastFrom?: number;
    /** Pairs of colors closer than this (CIEDE2000) are reported as near-duplicates. Defaults to 3. */
    duplicateDeltaE?: number;
}

/**
 * One of the analyzed colors, measured as shown (lifted to minBrightness), with its part in the theme.
 */
export interface PickAnalysis extends ColorMeasure {
    /** Its position in the colors analyzed. */
    index: number;
    /**
     * `structural` colors define the hue groups, `muted` ones follow them, and `neutral` ones (greys, whites
     * and blacks) take no part.
     */
    role: 'structural' | 'muted' | 'neutral';
    /** The index of its group in ThemeAnalysis.groups; null for a neutral color. */
    group: number | null;
    /** Its hue's signed distance from the anchor, in degrees, over −180 up to 180; null for a neutral color. */
    offset: number | null;
}

/**
 * A group of related hues: structural colors chained less than familyJoin apart, and the muted colors that
 * follow them (or muted colors on their own, when no structural color is near).
 */
export interface HueGroup {
    /**
     * Its hue in degrees, 0 to 360: the mean of its structural members' hues, weighted by their relative
     * chroma (for a group of muted colors on their own, the mean of theirs).
     */
    center: number;
    /** Degrees from its first member's hue to its last's, muted members included. */
    span: number;
    /** The indexes of its colors, in hue order. */
    members: number[];
    /** The sum of its members' relative chroma. */
    weight: number;
}

/**
 * A theme's hue relationship, as analyzeTheme finds it. Plain JSON: numbers, strings, arrays and null, with
 * no NaN.
 */
export interface ThemeAnalysis {
    relationship: Relationship;
    /**
     * The hue the theme is placed by: the center of its heaviest group (ties: the group holding the earliest
     * color). null when every color is neutral.
     */
    anchor: number | null;
    /** The hue groups: the anchor's first, then the others in hue order from it. */
    groups: HueGroup[];
    /** Every color analyzed, in order. */
    picks: PickAnalysis[];
    /** The indexes of the neutral colors. */
    neutrals: number[];
    /** Pairs of indexes of colors closer than duplicateDeltaE, each pair in order. */
    duplicates: [number, number][];
    /**
     * The arc of hue the groups occupy, in degrees: 360 less the largest gap between group centers. For a
     * single group, its span; 0 when there is none.
     */
    span: number;
    /** The options the analysis used, defaults filled in, so templates and checks can use the same ones. */
    options: Required<AnalyzeOptions>;
}

/** Colors under this brightness (HSV value) count as black: neutral whatever their chroma. */
const BLACK_BRIGHTNESS = 0.02;

/** Group weights closer than this count as equal, so the tie-break decides whatever the order of summing. */
const WEIGHT_TOLERANCE = 1e-9;

/** A group as it is built: its center, and each member's offset from it in degrees. */
interface Building {
    center: number;
    offsets: Map<number, number>;
}

/** A chain of hues as a group. */
function fromChain(chain: ReturnType<typeof link>[number]): Building {
    const center = chainCenter(chain);
    return {
        center: wrapHue(center),
        offsets: new Map(
            chain.members.map((member, k) => [
                member.index,
                chain.positions[k]! - center,
            ]),
        ),
    };
}

/**
 * Analyzes the hue relationship of a theme's colors: a few picks, or a whole palette.
 *
 * 1. Each color is measured (see measureColor), lifted to minBrightness. A color under neutralChroma, or
 *    under brightness 0.02, is neutral.
 * 2. Colors at or over structuralChroma are structural; if there are none, every color that is not neutral
 *    is.
 * 3. Structural hues chain into groups: in hue order around the circle, cut at every gap of familyJoin or
 *    more. A group's center is the mean of its hues, weighted by relative chroma.
 * 4. Each muted color joins the group of the nearest structural color, if that is within attachWithin.
 *    Muted colors no group takes chain into groups of their own, the same way.
 * 5. The relationship follows from the number of groups and the gaps between their centers (see
 *    Relationship). The anchor is the heaviest group's center.
 *
 * The result depends on the colors, not their order, except for ties broken by the earliest color. An empty
 * list is `neutral`, with no picks.
 */
export function analyzeTheme(
    colors: readonly ColorInput[],
    options?: AnalyzeOptions,
): ThemeAnalysis {
    const resolved = analyzeOptions(options);
    const {
        minBrightness,
        neutralChroma,
        structuralChroma,
        familyJoin,
        attachWithin,
        contrastFrom,
        duplicateDeltaE,
    } = resolved;

    const lifted = colors.map((color) => liftColor(color, minBrightness));
    const measures = lifted.map((color) => measureColor(color));
    const isNeutral = measures.map(
        ({ hue, chroma: c, brightness }) =>
            hue === null || c < neutralChroma || brightness < BLACK_BRIGHTNESS,
    );
    const chromatic: Linked[] = [];
    measures.forEach(({ hue, chroma: c }, index) => {
        if (!isNeutral[index]) {
            chromatic.push({ index, hue: hue!, weight: c });
        }
    });
    let structural = chromatic.filter(
        (item) => item.weight >= structuralChroma,
    );
    if (structural.length === 0) {
        structural = chromatic;
    }
    const isStructural = new Set(structural.map((item) => item.index));

    // groups of structural hues, then the muted colors that follow them
    const building = link(structural, familyJoin).map(fromChain);
    const structuralGroups = building.length;
    const loose: Linked[] = [];
    for (const item of chromatic) {
        if (isStructural.has(item.index)) continue;
        let nearest = -1;
        let nearestDistance = Infinity;
        // the nearest structural color: muted colors already taken don't count, so the order doesn't matter
        for (let g = 0; g < structuralGroups; g++) {
            building[g]!.offsets.forEach((_, member) => {
                if (!isStructural.has(member)) return;
                const distance = hueDistance(measures[member]!.hue!, item.hue);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = g;
                }
            });
        }
        if (nearest >= 0 && nearestDistance <= attachWithin) {
            const group = building[nearest]!;
            group.offsets.set(item.index, hueOffset(group.center, item.hue));
        } else {
            loose.push(item);
        }
    }
    building.push(...link(loose, familyJoin).map(fromChain));

    const unordered: HueGroup[] = building.map(({ center, offsets }) => {
        const members = [...offsets.keys()].sort(
            (a, b) => offsets.get(a)! - offsets.get(b)! || a - b,
        );
        const spread = [...offsets.values()];
        return {
            center,
            span: Math.max(...spread) - Math.min(...spread) + 0,
            members,
            weight: members.reduce(
                (sum, member) => sum + measures[member]!.chroma,
                0,
            ),
        };
    });

    // the heaviest group places the theme; the earliest color breaks a tie
    const first = (group: HueGroup) => Math.min(...group.members);
    let anchorGroup: HueGroup | undefined;
    for (const group of unordered) {
        if (
            !anchorGroup ||
            group.weight > anchorGroup.weight + WEIGHT_TOLERANCE ||
            (group.weight >= anchorGroup.weight - WEIGHT_TOLERANCE &&
                first(group) < first(anchorGroup))
        ) {
            anchorGroup = group;
        }
    }
    const anchor = anchorGroup ? anchorGroup.center : null;
    const others = unordered
        .filter((group) => group !== anchorGroup)
        .sort(
            (a, b) =>
                wrapHue(a.center - anchor!) - wrapHue(b.center - anchor!) ||
                first(a) - first(b),
        );
    const groups = anchorGroup ? [anchorGroup, ...others] : [];
    const groupOf = new Map<number, number>();
    groups.forEach((group, g) =>
        group.members.forEach((member) => groupOf.set(member, g)),
    );

    const picks: PickAnalysis[] = measures.map((measure, index) => {
        const neutral = isNeutral[index]!;
        return {
            ...measure,
            index,
            role: neutral
                ? 'neutral'
                : isStructural.has(index)
                  ? 'structural'
                  : 'muted',
            group: neutral ? null : groupOf.get(index)!,
            offset: neutral ? null : hueOffset(anchor!, measure.hue!),
        };
    });

    const duplicates: [number, number][] = [];
    for (let i = 0; i < lifted.length; i++) {
        for (let j = i + 1; j < lifted.length; j++) {
            if (
                chroma.deltaE(lifted[i]!, lifted[j]!, 1, 1, 1) < duplicateDeltaE
            ) {
                duplicates.push([i, j]);
            }
        }
    }

    const { relationship, span } = classifyGroups(groups, contrastFrom);
    return {
        relationship,
        anchor,
        groups,
        picks,
        neutrals: picks
            .filter((pick) => pick.role === 'neutral')
            .map((pick) => pick.index),
        duplicates,
        span,
        options: resolved,
    };
}
