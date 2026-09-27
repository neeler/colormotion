import { Color } from 'chroma-js';
import { DEFAULT_DELTA_E_THRESHOLD, RandomFunction } from './ColorPalette';
import {
    AnalyzeOptions,
    PickAnalysis,
    Relationship,
    ThemeAnalysis,
    analyzeTheme,
} from './analyze';
import { clamp } from './clamp';
import {
    ChromaRange,
    ColorConstraint,
    HueRange,
    randomColor,
} from './constraints';
import {
    HueSet,
    distanceToHues,
    hueAlong,
    huesWithout,
    unionHues,
} from './hueArcs';
import {
    analyzeOptions,
    classifyGroups,
    hueDistance,
    hueOffset,
    wrapHue,
} from './hueGroups';

/*
 * Relationship templates: a theme's hue relationship as slots placed around an anchor hue, so colors can be
 * drawn near the theme's own (adjacent) or in the same relationship at another anchor (randomLike).
 */

/**
 * One color's place in a relationship template: an arc of hue relative to the anchor, and a band of relative
 * chroma that keeps a color drawn in it in its role.
 */
export interface TemplateSlot {
    /**
     * The role of the color the slot stands for (see PickAnalysis.role). Its chroma band keeps a color drawn
     * in it in that role.
     */
    role: 'structural' | 'muted' | 'neutral';
    /**
     * The slot's hue, in degrees from the anchor (structural and muted slots). null for a neutral slot, which
     * never rotates or mirrors.
     */
    offset: number | null;
    /**
     * The full width of the slot's arc of hue, in degrees: half of it either side of the slot's hue (for a
     * neutral slot, of its tint; 360 for a neutral slot with no tint).
     */
    hueWidth: number;
    /**
     * A neutral slot's own tint, as an absolute OKLCH hue: it keeps the tint of a neutral color with a
     * relative chroma of 0.04 or more, within 30° either side. null for any hue, and for the other slots.
     */
    tint: number | null;
    /**
     * The relative chroma allowed, both bounds given: the color's own ± chromaWidth, within its role's
     * interval, so a color drawn in the slot keeps its role. The intervals sit a little inside the
     * thresholds, so that a color rounded to 8 bits keeps its role too: with the defaults, 0.77–1 for
     * structural slots, 0.15–0.72 for muted ones and 0–0.08 for neutral ones. In a theme with no color at
     * structuralChroma (pastels, whose colors are all structural), structural slots take 0.15–0.72 as well,
     * so none turns vivid. Narrower where a group sits near a threshold of the relationship (see
     * relationshipTemplate).
     */
    chroma: ChromaRange;
    /** The index of the slot's group in the template's groups; null for a neutral slot. */
    group: number | null;
    /**
     * The input color whose neighbourhood this is, for a template from an analysis: its index in the colors
     * analyzed. null for a template from a kind.
     */
    pick: number | null;
}

/**
 * A theme's hue relationship as slots around an anchor hue (see relationshipTemplate). Plain JSON.
 */
export interface RelationshipTemplate {
    /** The relationship a palette drawn in the slots has. */
    relationship: Relationship;
    /** The hue groups: each one's center in degrees from the anchor, and its span. The anchor's is first. */
    groups: { offset: number; span: number }[];
    /** The slots, in order: a palette drawn from the template has one color per slot, in this order. */
    slots: TemplateSlot[];
    /**
     * For a template from an analysis: pickSlots[j] is the index of the slot that holds input color j (its
     * own slot, first in its run). null for a template from a kind.
     */
    pickSlots: number[] | null;
    /** The analysis options, defaults filled in: randomLike checks a palette drawn from the template with them. */
    options: Required<AnalyzeOptions>;
}

/**
 * Options for relationshipTemplate and adjacentConstraints: how wide the slots are, and how many there are.
 * A value that is not a finite number counts as not given.
 */
export interface TemplateOptions {
    /**
     * The base half-width of a slot's arc of hue, in degrees (see relationshipTemplate). Defaults to 12 for a
     * template from an analysis, and to 8 for one from a kind (and for randomLike, given an analysis).
     */
    hueWidth?: number;
    /** The widest half-width a slot takes before its caps, in degrees. Defaults to 20. */
    maxHueWidth?: number;
    /** The narrowest half-width a slot takes before its caps, in degrees. Defaults to 3. */
    minHueWidth?: number;
    /** How far a slot's chroma band reaches either side of its color's relative chroma. Defaults to 0.2. */
    chromaWidth?: number;
    /**
     * For a template from an analysis: the number of slots to lay out. Defaults to the number of colors
     * analyzed, which is also the least it takes (see relationshipTemplate).
     */
    nColors?: number;
}

/**
 * Options for randomLike.
 */
export interface RandomLikeOptions {
    /** Random number generator. Defaults to Math.random. Supply a seeded generator for reproducible palettes. */
    random?: RandomFunction;
    /**
     * The lowest brightness (HSV value) of the colors, from 0 to 1. Defaults to the minBrightness the source
     * was analyzed at (0 for a template from a kind).
     */
    minBrightness?: number;
    /**
     * How far each color is kept (CIEDE2000) from the one before it, and the last from the first as well,
     * since the wheel closes there. Best effort, as for any random color. Defaults to
     * DEFAULT_DELTA_E_THRESHOLD (20).
     */
    deltaEThreshold?: number;
    /**
     * The anchor: a hue to place the template at, or the arcs (one or several) to draw it from, uniformly.
     * Left out, any hue.
     */
    anchor?: number | HueRange | readonly HueRange[];
    /** Allows the mirrored geometry, drawn half the time. Defaults to true. */
    mirror?: boolean;
    /**
     * Hues to keep out: added to every rotating slot's avoid, and no drawn anchor puts a slot's hue inside
     * them (when any anchor allowed can).
     */
    avoid?: readonly HueRange[];
    /** How many palettes to draw, at most, until one has the source's relationship. Defaults to 16. */
    attempts?: number;
    /** For an analysis: the number of colors (see TemplateOptions.nColors). Ignored for a template. */
    nColors?: number;
}

/**
 * A palette randomLike drew, and where.
 */
export interface RandomLikeResult {
    /** One color per slot, in the template's slot order, at full precision. */
    colors: Color[];
    /** The anchor the template was placed at, in degrees. */
    anchor: number;
    /** Whether it was mirrored. */
    mirrored: boolean;
    /**
     * The constraint for each color, as templateConstraints gives them for this anchor and mirroring: keep
     * them for rolling single colors in the same shape.
     */
    constraints: ColorConstraint[];
    /** The relationship the colors have, analyzed with the source's options. */
    relationship: Relationship;
    /**
     * Whether the colors have the source's relationship and number of groups. When no attempt did, the
     * closest is returned, with verified false.
     */
    verified: boolean;
}

/** Base half-width of a slot's hue arc in a template from an analysis: the adjacent neighbourhood. */
const ANALYSIS_HUE_WIDTH = 12;
/** Base half-width of a slot's hue arc in a template from a kind, and for randomLike given an analysis. */
const LIKE_HUE_WIDTH = 8;
const MAX_HUE_WIDTH = 20;
const MIN_HUE_WIDTH = 3;
const CHROMA_WIDTH = 0.2;
/**
 * How far over structuralChroma a structural slot's chroma band stays, and how far inside neutralChroma and
 * structuralChroma a muted slot's does: a color drawn at a band's end and rounded to 8 bits keeps its role.
 */
const STRUCTURAL_MARGIN = 0.02;
const MUTED_MARGIN = 0.03;
/** How far under neutralChroma a neutral slot's chroma band stays. */
const NEUTRAL_MARGIN = 0.04;
/** A neutral color at least this saturated keeps its tint. */
const TINT_CHROMA = 0.04;
/** The full width of a neutral slot's tint, in degrees. */
const TINT_WIDTH = 60;
/** Degrees kept spare in the caps on widths, so hues measured a hair off never cross a threshold. */
const CAP_MARGIN = 1e-3;
const DEFAULT_ATTEMPTS = 16;

/** Template options with defaults filled in. */
function templateOptions(options: TemplateOptions, hueWidth: number) {
    const value = (given: number | undefined, otherwise: number) =>
        typeof given === 'number' && Number.isFinite(given)
            ? Math.max(0, given)
            : otherwise;
    return {
        hueWidth: value(options.hueWidth, hueWidth),
        maxHueWidth: value(options.maxHueWidth, MAX_HUE_WIDTH),
        minHueWidth: value(options.minHueWidth, MIN_HUE_WIDTH),
        chromaWidth: value(options.chromaWidth, CHROMA_WIDTH),
    };
}

type ResolvedTemplateOptions = ReturnType<typeof templateOptions>;

/** A slot's half-width before its caps: the base, plus a quarter of its group's span, within the bounds. */
function baseHalfWidth(span: number, o: ResolvedTemplateOptions) {
    return clamp(o.hueWidth + span / 4, o.minHueWidth, o.maxHueWidth);
}

/** A bound with the floating-point noise of adding the margins taken off: 0.12 − 0.04 is 0.08. */
const tidy = (bound: number) => Math.round(bound * 1e12) / 1e12;

/** The interval of relative chroma a color keeps its role within. */
function roleInterval(
    role: TemplateSlot['role'],
    chroma: number,
    { neutralChroma, structuralChroma }: Required<AnalyzeOptions>,
): [number, number] {
    if (role === 'neutral') {
        return [0, tidy(Math.max(0, neutralChroma - NEUTRAL_MARGIN))];
    }
    if (chroma >= structuralChroma) {
        return [tidy(Math.min(1, structuralChroma + STRUCTURAL_MARGIN)), 1];
    }
    const low = tidy(neutralChroma + MUTED_MARGIN);
    const high = tidy(structuralChroma - MUTED_MARGIN);
    return low <= high ? [low, high] : [(low + high) / 2, (low + high) / 2];
}

/** A chroma band: from chroma − width to chroma + width, kept within the interval. */
function chromaBand(
    chroma: number,
    width: number,
    [low, high]: [number, number],
): ChromaRange {
    return {
        min: clamp(chroma - width, low, high),
        max: clamp(chroma + width, low, high),
    };
}

/** A number of slots: a whole number, at least `least`; `otherwise` when not a finite number. */
function slotCount(
    given: number | undefined,
    least: number,
    otherwise: number,
) {
    return typeof given === 'number' && Number.isFinite(given)
        ? Math.max(least, Math.floor(given))
        : otherwise;
}

/**
 * Shares n among weights by largest remainder: each gets the whole part of its quota (and at least `least`),
 * and the rest go one each to the largest remainders (ties: the earlier). n must be at least `least` times
 * the number of weights.
 */
function shareOut(n: number, weights: readonly number[], least = 0) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const quotas = weights.map((weight) =>
        total > 0 ? (n * weight) / total : n / weights.length,
    );
    const shares = quotas.map((quota) => Math.max(least, Math.floor(quota)));
    let left = n - shares.reduce((sum, share) => sum + share, 0);
    const byRemainder = quotas
        .map((quota, i) => ({ i, remainder: quota - shares[i]! }))
        .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    for (const { i } of byRemainder) {
        if (left <= 0) break;
        shares[i]!++;
        left--;
    }
    // shares held up to `least` can leave too many: take them back from the smallest remainders
    for (const { i } of [...byRemainder].reverse()) {
        if (left >= 0) break;
        if (shares[i]! > least) {
            shares[i]!--;
            left++;
        }
    }
    return shares;
}

/** A slot as it is laid out, before its width. */
type SlotDraft = Omit<TemplateSlot, 'hueWidth'>;

/** A group as it is laid out: its center's offset from the anchor, its span, and whether it is all muted. */
interface GroupDraft {
    offset: number;
    span: number;
    /** A group of muted colors on their own, which no structural color took. */
    loose: boolean;
}

/**
 * How far each group's center can move, in degrees, before the relationship of groups with these centers
 * changes: half the margin to each threshold of classifyGroups the group takes part in (Infinity for none).
 */
function centerBudgets(centers: readonly number[], contrastFrom: number) {
    const budgets = centers.map(() => Infinity);
    const limit = (a: number, b: number, margin: number) => {
        const half = Math.max(0, margin) / 2;
        budgets[a] = Math.min(budgets[a]!, half);
        budgets[b] = Math.min(budgets[b]!, half);
    };
    if (centers.length === 2) {
        limit(
            0,
            1,
            Math.abs(hueDistance(centers[0]!, centers[1]!) - contrastFrom),
        );
    } else if (centers.length === 3) {
        const order = [0, 1, 2].sort(
            (a, b) => wrapHue(centers[a]!) - wrapHue(centers[b]!),
        );
        const gaps = order.map((from, i) => {
            const to = order[(i + 1) % 3]!;
            return { from, to, gap: wrapHue(centers[to]! - centers[from]!) };
        });
        const largest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
        const smallest = gaps.reduce((a, b) => (b.gap < a.gap ? b : a));
        if (largest.gap >= 180) {
            // within half the wheel: the largest gap stays over 180°, and the span on its side of contrastFrom
            limit(largest.from, largest.to, largest.gap - 180);
            limit(
                largest.from,
                largest.to,
                Math.abs(360 - largest.gap - contrastFrom),
            );
        } else {
            for (const { from, to, gap } of gaps) {
                limit(from, to, 180 - gap);
            }
            if (smallest.gap >= contrastFrom) {
                // a triad: every gap stays at contrastFrom or more
                for (const { from, to, gap } of gaps) {
                    limit(from, to, gap - contrastFrom);
                }
            } else {
                limit(smallest.from, smallest.to, contrastFrom - smallest.gap);
            }
        }
    }
    return budgets;
}

/**
 * How far from 0 the weighted mean of these deviations can reach, with each weight anywhere in its range.
 */
function meanReach(
    members: readonly { deviation: number; low: number; high: number }[],
) {
    let reach = 0;
    for (const sign of [1, -1]) {
        // the mean is furthest with the full weight on the deviations furthest out: a run of them
        const sorted = [...members].sort(
            (a, b) => sign * (b.deviation - a.deviation),
        );
        for (let k = 0; k <= sorted.length; k++) {
            let sum = 0;
            let total = 0;
            sorted.forEach(({ deviation, low, high }, i) => {
                const weight = i < k ? high : low;
                sum += weight * deviation;
                total += weight;
            });
            if (total > 0) {
                reach = Math.max(reach, (sign * sum) / total);
            }
        }
    }
    return reach;
}

/**
 * The half-width of each slot's arc of hue: the base (hueWidth + a quarter of the group's span, within the
 * bounds), then capped so that no palette drawn within the slots can change the relationship:
 * - hues that define different groups stay familyJoin apart, so the groups never merge (structural hues,
 *   and the hues of muted groups on their own), and the hues that chain a group, taken in hue order, stay
 *   closer than familyJoin, so no group splits;
 * - muted groups on their own stay further than attachWithin from every structural hue, so none is taken,
 *   and muted slots that follow a group stay within attachWithin of a structural hue, so none goes off on
 *   its own;
 * - no group's center, the mean of its slots' hues weighted by their chroma, can move across a threshold of
 *   the relationship (contrastFrom between two groups; for three, half the wheel, contrastFrom for the span
 *   or the gaps). Where the weights alone could move it across, the slots keep their hue, and their chroma
 *   bands narrow (in place) toward `own`, each slot's own relative chroma, until the weights can't, or as far
 *   as they go.
 * A neutral slot's is 30° around its tint, or 180° (any hue).
 */
function halfWidths(
    slots: readonly SlotDraft[],
    groups: readonly GroupDraft[],
    { familyJoin, attachWithin, contrastFrom }: Required<AnalyzeOptions>,
    o: ResolvedTemplateOptions,
    own: readonly number[],
) {
    const rotates = (slot: SlotDraft) =>
        slot.offset !== null && slot.group !== null;
    const loose = (slot: SlotDraft) => groups[slot.group!]!.loose;
    const structural = (slot: SlotDraft) =>
        rotates(slot) && slot.role === 'structural';
    const looseMuted = (slot: SlotDraft) =>
        rotates(slot) && slot.role === 'muted' && loose(slot);
    const follower = (slot: SlotDraft) =>
        rotates(slot) && slot.role === 'muted' && !loose(slot);
    // the slots whose hues set their group's center
    const defining = (slot: SlotDraft) => structural(slot) || looseMuted(slot);
    const distance = (a: SlotDraft, b: SlotDraft) =>
        hueDistance(a.offset!, b.offset!);

    const halves = slots.map((slot) =>
        rotates(slot)
            ? baseHalfWidth(groups[slot.group!]!.span, o)
            : slot.tint === null
              ? 180
              : TINT_WIDTH / 2,
    );
    const cap = (i: number, half: number) => {
        halves[i] = Math.min(halves[i]!, Math.max(0, half));
    };

    // groups never merge
    slots.forEach((a, i) => {
        slots.forEach((b, j) => {
            if (
                j > i &&
                defining(a) &&
                defining(b) &&
                a.group !== b.group &&
                structural(a) === structural(b)
            ) {
                const half = (distance(a, b) - familyJoin - CAP_MARGIN) / 2;
                cap(i, half);
                cap(j, half);
            }
        });
    });
    // groups never split: the hues that chain a group, taken in hue order, stay closer than familyJoin
    groups.forEach((group, g) => {
        const chain = slots
            .map((slot, i) => ({
                i,
                position: defining(slot)
                    ? hueOffset(group.offset, slot.offset!)
                    : NaN,
            }))
            .filter(
                ({ i, position }) =>
                    slots[i]!.group === g && !Number.isNaN(position),
            )
            .sort((a, b) => a.position - b.position || a.i - b.i);
        for (let k = 1; k < chain.length; k++) {
            const half =
                (familyJoin -
                    (chain[k]!.position - chain[k - 1]!.position) -
                    CAP_MARGIN) /
                2;
            cap(chain[k - 1]!.i, half);
            cap(chain[k]!.i, half);
        }
    });
    // muted groups on their own stay clear of every structural hue: the structural slot first
    slots.forEach((a, i) => {
        slots.forEach((b) => {
            if (structural(a) && looseMuted(b)) {
                cap(i, distance(a, b) - attachWithin - CAP_MARGIN);
            }
        });
    });
    slots.forEach((a, i) => {
        slots.forEach((b, j) => {
            if (looseMuted(a) && structural(b)) {
                cap(i, distance(a, b) - attachWithin - halves[j]! - CAP_MARGIN);
            }
        });
    });

    // centers stay clear of the thresholds
    const budgets = centerBudgets(
        groups.map((group) => group.offset),
        contrastFrom,
    );
    groups.forEach((group, g) => {
        const budget = budgets[g]!;
        if (!Number.isFinite(budget)) return;
        const members = slots
            .map((slot, i) => ({ slot, i }))
            .filter(({ slot }) => slot.group === g && defining(slot));
        // each member's hue, and its chroma band narrowed by t (1: as it is) toward its own chroma
        const weights = (t: number) =>
            members.map(({ slot, i }) => {
                const low = slot.chroma.min ?? 0;
                const high = slot.chroma.max ?? 1;
                const at = clamp(own[i]!, low, high);
                return {
                    deviation: hueOffset(group.offset, slot.offset!),
                    low: at - t * (at - low),
                    high: at + t * (high - at),
                };
            });
        let reach = meanReach(weights(1));
        if (
            reach >= budget - CAP_MARGIN &&
            meanReach(weights(0)) < budget - CAP_MARGIN
        ) {
            // the weights alone could move the center across: the bands narrow until they can't. (At their
            // own chroma, the extra slots can already move it too far: then no band helps, and they stay.)
            let within = 0;
            let beyond = 1;
            for (let k = 0; k < 40; k++) {
                const t = (within + beyond) / 2;
                if (meanReach(weights(t)) < budget - CAP_MARGIN) {
                    within = t;
                } else {
                    beyond = t;
                }
            }
            const narrowed = weights(within);
            members.forEach(({ slot }, k) => {
                slot.chroma = { min: narrowed[k]!.low, max: narrowed[k]!.high };
            });
            reach = meanReach(narrowed);
        }
        for (const { i } of members) {
            cap(i, budget - reach - CAP_MARGIN);
        }
    });

    // muted slots that follow a group stay within attachWithin of a structural hue, wherever it lands
    const attached = (a: SlotDraft) => {
        // how far a's hue can move and stay within attachWithin of a structural hue, however far each moves
        // in its slot; null when a's own hue is not sure to
        const reached = slots
            .map((b, j) => ({ b, j }))
            .filter(({ b }) => structural(b))
            .map(({ b, j }) => {
                const offset = hueOffset(a.offset!, b.offset!);
                const radius = attachWithin - halves[j]! - CAP_MARGIN;
                return [offset - radius, offset + radius] as [number, number];
            })
            .filter(([low, high]) => low <= high)
            .sort((x, y) => x[0] - y[0]);
        let low = Infinity;
        let high = -Infinity;
        for (const [from, to] of reached) {
            // stretches that meet join (the ends of two of them often meet exactly: at the default
            // thresholds, attachWithin is half of contrastFrom)
            if (from <= high + 1e-9) {
                high = Math.max(high, to);
            } else if (high >= 0) {
                break;
            } else {
                low = from;
                high = to;
            }
        }
        return low <= 0 && high >= 0 ? Math.min(-low, high) : null;
    };
    // where no structural slot is sure to stay near enough, however narrow the muted slot is, the nearest
    // one narrows until it is (all at once, so the order of the slots doesn't matter), and the muted one
    // keeps its hue
    const narrowing = slots.map((a) => {
        if (!follower(a) || attached(a) !== null) return null;
        let nearest = -1;
        slots.forEach((b, j) => {
            if (
                structural(b) &&
                (nearest < 0 || distance(a, b) < distance(a, slots[nearest]!))
            ) {
                nearest = j;
            }
        });
        return nearest < 0
            ? null
            : {
                  nearest,
                  half:
                      attachWithin -
                      distance(a, slots[nearest]!) -
                      2 * CAP_MARGIN,
              };
    });
    narrowing.forEach((narrow) => {
        if (narrow) cap(narrow.nearest, narrow.half);
    });
    slots.forEach((a, i) => {
        if (follower(a)) cap(i, attached(a) ?? 0);
    });

    return halves;
}

/** The slot of an analyzed color, before its width. */
function pickDraft(
    pick: PickAnalysis,
    options: Required<AnalyzeOptions>,
    o: ResolvedTemplateOptions,
): SlotDraft {
    const chroma = chromaBand(
        pick.chroma,
        o.chromaWidth,
        roleInterval(pick.role, pick.chroma, options),
    );
    if (pick.role === 'neutral' || pick.group === null) {
        return {
            role: 'neutral',
            offset: null,
            tint:
                pick.hue !== null && pick.chroma >= TINT_CHROMA
                    ? pick.hue
                    : null,
            chroma,
            group: null,
            pick: pick.index,
        };
    }
    return {
        role: pick.role,
        offset: pick.offset!,
        tint: null,
        chroma,
        group: pick.group,
        pick: pick.index,
    };
}

/** A template from an analysis: see relationshipTemplate. */
function templateFromAnalysis(
    analysis: ThemeAnalysis,
    options: TemplateOptions,
): RelationshipTemplate {
    const resolved = analyzeOptions(analysis.options);
    const o = templateOptions(options, ANALYSIS_HUE_WIDTH);
    const { picks } = analysis;
    const n = slotCount(options.nColors, picks.length, picks.length);

    // the extra slots go to the chromatic colors by chroma (to every color evenly if all are neutral)
    const chromatic = picks.some((pick) => pick.role !== 'neutral');
    const extras =
        n > picks.length
            ? shareOut(
                  n - picks.length,
                  picks.map((pick) =>
                      !chromatic
                          ? 1
                          : pick.role === 'neutral'
                            ? 0
                            : pick.chroma,
                  ),
              )
            : picks.map(() => 0);

    const drafts: SlotDraft[] = [];
    const own: number[] = [];
    const pickSlots: number[] = [];
    picks.forEach((pick, j) => {
        const draft = pickDraft(pick, resolved, o);
        pickSlots.push(drafts.length);
        for (let copy = 0; copy <= extras[j]!; copy++) {
            drafts.push({ ...draft, chroma: { ...draft.chroma } });
            own.push(pick.chroma);
        }
    });

    const groups = analysis.groups.map((group) => ({
        offset: hueOffset(analysis.anchor ?? 0, group.center),
        span: group.span,
        loose: !group.members.some(
            (member) => picks[member]?.role === 'structural',
        ),
    }));
    const halves = halfWidths(drafts, groups, resolved, o, own);
    return {
        relationship: analysis.relationship,
        groups: groups.map(({ offset, span }) => ({ offset, span })),
        slots: drafts.map((draft, i) => ({
            ...draft,
            hueWidth: 2 * halves[i]!,
        })),
        pickSlots,
        options: resolved,
    };
}

/** The weight of every group but the anchor's when sharing out a template's slots (the anchor's is 2). */
const GROUP_WEIGHT = 1;
const ANCHOR_GROUP_WEIGHT = 2;
/** Degrees kept between the slots of different groups in a template from a kind, beyond familyJoin. */
const KIND_GROUP_MARGIN = 4;
/** The range of a family's span, and of any other group's with several slots, in a template from a kind. */
const FAMILY_SPAN: [number, number] = [20, 40];
const GROUP_SPAN: [number, number] = [10, 20];
/** How far past its group's end a tint sits, in a template from a kind. */
const TINT_OFFSET: [number, number] = [5, 20];
const TINT_CHROMA_BAND: ChromaRange = { min: 0.3, max: 0.6 };

/** A value along a range, from a random number from 0 to 1. */
const along = ([from, to]: [number, number], u: number) =>
    from + u * (to - from);

/**
 * The group centers of a kind, in degrees from the anchor, the anchor's first and then from heaviest to
 * lightest (the lightest are dropped first when there are fewer slots than groups).
 */
function kindGroups(
    kind: Exclude<Relationship, 'neutral'>,
    slots: number,
    structural: number,
    random: RandomFunction,
    familyJoin: number,
): number[] {
    switch (kind) {
        case 'family':
            return [0];
        case 'accent':
            return [0, along([50, 80], random())];
        case 'contrast':
            return [0, along([150, 180], random())];
        case 'bridge': {
            // the ends 100–140° apart, the middle 35–65 % of the way
            const end = along([100, 140], random());
            return [0, end, end * along([0.35, 0.65], random())];
        }
        case 'pair-accent': {
            // a pair 35–60° apart, and an accent across from the pair's middle, within 10° of halving the wheel
            const pair = along([35, 60], random());
            const across = along(
                [180 - pair / 2 + 10, 180 + pair / 2 - 10],
                random(),
            );
            return [0, pair, pair / 2 + across];
        }
        case 'triad':
            return [
                0,
                120 + along([-12, 12], random()),
                240 + along([-12, 12], random()),
            ];
        case 'spectrum': {
            // evenly spaced: at least four (with that many slots), and no more than fit with room between them
            const k = Math.max(
                1,
                Math.min(
                    Math.max(structural, Math.min(4, slots)),
                    Math.floor(360 / (familyJoin + 15)),
                ),
            );
            return Array.from({ length: k }, (_, i) => (360 * i) / k);
        }
    }
}

/** A template drawn from a kind: see relationshipTemplate. */
function templateFromKind(
    kind: Exclude<Relationship, 'neutral'>,
    options: TemplateOptions & { random?: RandomFunction; tints?: number },
): RelationshipTemplate {
    const resolved = analyzeOptions();
    const { familyJoin, structuralChroma, contrastFrom } = resolved;
    const o = templateOptions(options, LIKE_HUE_WIDTH);
    const random = options.random ?? Math.random;
    const n = slotCount(options.nColors, 1, 1);
    let tints = Math.min(n - 1, slotCount(options.tints, 0, 0));

    let centers = kindGroups(kind, n, n - tints, random, familyJoin);
    // fewer structural slots than groups: fewer tints, then drop the lightest groups
    tints = Math.max(0, Math.min(tints, n - centers.length));
    centers = centers.slice(0, n - tints);
    const k = centers.length;

    // the slots go by weight, the anchor's group twice the others', and every group gets one
    const sizes = shareOut(
        n - tints,
        centers.map((_, g) => (g === 0 ? ANCHOR_GROUP_WEIGHT : GROUP_WEIGHT)),
        1,
    );

    // spans, each kept clear of the nearest other group, with its slots closer than familyJoin
    const spans = centers.map((center, g) => {
        const u = random();
        if (sizes[g]! < 2) return 0;
        const room = Math.min(
            (familyJoin - KIND_GROUP_MARGIN) * (sizes[g]! - 1),
            ...centers
                .filter((_, h) => h !== g)
                .map(
                    (other) =>
                        hueDistance(center, other) -
                        familyJoin -
                        KIND_GROUP_MARGIN,
                ),
        );
        return Math.max(
            0,
            Math.min(
                along(kind === 'family' ? FAMILY_SPAN : GROUP_SPAN, u),
                room,
            ),
        );
    });

    const drafts: SlotDraft[] = [];
    const draft = (
        role: 'structural' | 'muted',
        offset: number,
        group: number,
    ) =>
        drafts.push({
            role,
            offset: hueOffset(0, offset),
            tint: null,
            chroma:
                role === 'structural'
                    ? {
                          min: tidy(
                              Math.min(1, structuralChroma + STRUCTURAL_MARGIN),
                          ),
                          max: 1,
                      }
                    : { ...TINT_CHROMA_BAND },
            group,
            pick: null,
        });
    centers.forEach((center, g) => {
        const size = sizes[g]!;
        for (let s = 0; s < size; s++) {
            draft(
                'structural',
                size < 2
                    ? center
                    : center - spans[g]! / 2 + (spans[g]! * s) / (size - 1),
                g,
            );
        }
    });
    // tints follow the groups in turn, from the anchor's, just past either end of a group
    for (let t = 0; t < tints; t++) {
        const g = t % k;
        const side = random() < 0.5 ? -1 : 1;
        draft(
            'muted',
            centers[g]! + side * (spans[g]! / 2 + along(TINT_OFFSET, random())),
            g,
        );
    }

    const groups = centers.map((center, g) => ({
        offset: hueOffset(0, center),
        span: spans[g]!,
        loose: false,
    }));
    // a slot's own chroma: the middle of its band
    const halves = halfWidths(
        drafts,
        groups,
        resolved,
        o,
        drafts.map(({ chroma }) => ((chroma.min ?? 0) + (chroma.max ?? 1)) / 2),
    );

    // in hue order around the wheel, from the start of the anchor's group
    const start = -spans[0]! / 2 - 1e-9;
    const order = drafts
        .map((_, i) => i)
        .sort(
            (a, b) =>
                wrapHue(drafts[a]!.offset! - start) -
                    wrapHue(drafts[b]!.offset! - start) || a - b,
        );
    const slots: TemplateSlot[] = order.map((i) => ({
        ...drafts[i]!,
        hueWidth: 2 * halves[i]!,
    }));

    return {
        relationship: classifyGroups(
            groups.map(({ offset, span }) => ({ center: offset, span })),
            contrastFrom,
        ).relationship,
        groups: groups.map(({ offset, span }) => ({ offset, span })),
        slots,
        pickSlots: null,
        options: resolved,
    };
}

/**
 * A theme's hue relationship as slots around its anchor, from its analysis: one slot for each color
 * analyzed, in order, for colors drawn near it.
 *
 * Each slot keeps its color's role, offset from the anchor and group, and a band of relative chroma that
 * keeps it in its role (see TemplateSlot.chroma). Its arc of hue reaches hueWidth + span / 4 either side of
 * the color's hue (span: its group's), within minHueWidth and maxHueWidth, so tight picks get tight
 * neighbourhoods and wide families wider ones. It is then narrowed where it has to be, so that no palette
 * drawn within the slots changes the theme's relationship or number of groups:
 * - A structural slot reaches no more than (d − familyJoin) / 2, where d is the distance to the nearest
 *   structural color of another group, so two groups never merge. The colors that chain a group, taken in
 *   hue order, stay less than familyJoin apart, so no group splits.
 * - A muted color that follows a group stays within attachWithin of a structural color (the nearest
 *   structural slot narrows too, where it has to); a group of muted colors on their own stays further than
 *   attachWithin from every one.
 * - Where the theme sits near a threshold of its relationship (contrastFrom between two groups; for three,
 *   half the wheel, and contrastFrom for the span or the gaps), a group's center, the mean of its hues
 *   weighted by chroma, cannot move across it. When the weights alone could move it across, the slots keep
 *   their hue exactly, and their chroma bands narrow toward their colors' own until the weights can't.
 *   (Extra slots for nColors can move a center on their own, as they weigh one color of a group more than
 *   another: a group a degree or two from a threshold can then cross it however narrow its slots.)
 * A neutral slot stays neutral: any hue, or within 30° of its color's tint.
 *
 * With nColors greater than the number of colors analyzed, the extra slots go to the colors that are not
 * neutral, in proportion to their relative chroma (largest remainder; ties to the earlier color); if every
 * color is neutral, evenly. Each color gets a run of slots, in input order: its own slot (see pickSlots),
 * then its extras, which copy it. Fewer than the number of colors counts as that number.
 */
export function relationshipTemplate(
    analysis: ThemeAnalysis,
    options?: TemplateOptions,
): RelationshipTemplate;
/**
 * A template drawn for a kind of relationship, with nColors slots: its geometry drawn with random within
 * these ranges, as offsets from the anchor, and its slots as wide as for a template from an analysis (a base
 * half-width of 8° unless given).
 * - `family`: one group spanning 20–40°.
 * - `accent`: a second group 50–80° away.
 * - `contrast`: a second group 150–180° away.
 * - `bridge`: ends 100–140° apart, the middle 35–65 % of the way.
 * - `pair-accent`: a pair 35–60° apart, and an accent across from the pair's middle.
 * - `triad`: 120° apart, ± 12°.
 * - `spectrum`: evenly spaced, one group per structural slot: at least four (given four slots), and no
 *   more than fit 45° apart.
 *
 * The slots are shared among the groups by weight, the anchor's group twice the others', each group getting
 * at least one. Groups of
 * several slots span 10–20° (a family, 20–40°), with their slots less than familyJoin apart. The slots run
 * in hue order from the anchor's group, so a palette's gradient runs through the relationship and closes
 * back on itself. `tints` of the slots are muted tints (relative chroma 0.3–0.6), each placed just past an
 * end of a group, in turn from the anchor's; the others are structural (0.77–1). With fewer slots than
 * groups, the lightest groups are dropped: a triad of 2 colors is a contrast pair. The template's
 * relationship is the one its geometry has.
 */
export function relationshipTemplate(
    kind: Exclude<Relationship, 'neutral'>,
    options: TemplateOptions & {
        /** The number of slots: 1 or more. */
        nColors: number;
        /** Random number generator for the geometry. Defaults to Math.random. */
        random?: RandomFunction;
        /** How many of the slots are muted tints (relative chroma 0.3–0.6) that follow the groups. Defaults to 0. */
        tints?: number;
    },
): RelationshipTemplate;
export function relationshipTemplate(
    source: ThemeAnalysis | Exclude<Relationship, 'neutral'>,
    options: TemplateOptions & { random?: RandomFunction; tints?: number } = {},
): RelationshipTemplate {
    return typeof source === 'string'
        ? templateFromKind(source, options)
        : templateFromAnalysis(source, options);
}

/**
 * The constraint for each slot of a template placed at an anchor hue (degrees; not a finite number counts as
 * 0): each structural and muted slot's arc of hue centered on anchor + offset (anchor − offset when
 * mirrored), with its chroma band. Neutral slots never rotate or mirror: any hue, or near their tint. `avoid`
 * is added to every rotating slot.
 */
export function templateConstraints(
    template: RelationshipTemplate,
    anchor: number,
    {
        mirrored = false,
        avoid = [],
    }: {
        /** Mirrors the template: every offset from the anchor is negated. Defaults to false. */
        mirrored?: boolean;
        /** Hues added to the avoid of every rotating slot (see ColorConstraint.avoid). */
        avoid?: readonly HueRange[];
    } = {},
): ColorConstraint[] {
    const at = Number.isFinite(anchor) ? anchor : 0;
    return template.slots.map((slot) => {
        const chroma = { ...slot.chroma };
        if (slot.offset === null) {
            return slot.tint === null
                ? { chroma }
                : {
                      hues: [{ center: slot.tint, width: slot.hueWidth }],
                      chroma,
                  };
        }
        const center = wrapHue(at + (mirrored ? -slot.offset : slot.offset));
        return {
            hues: [{ center, width: slot.hueWidth }],
            ...(avoid.length > 0 && {
                avoid: avoid.map((range) => ({ ...range })),
            }),
            chroma,
        };
    });
}

/**
 * The neighbourhood of each color of a theme, from its analysis: templateConstraints of its template
 * (relationshipTemplate, a base half-width of 12° unless given) at its own anchor. A color drawn within
 * constraints[i] stays near color i, in its role; with nColors, the extra positions are near the color
 * their run copies (see relationshipTemplate).
 */
export function adjacentConstraints(
    analysis: ThemeAnalysis,
    options?: TemplateOptions,
): ColorConstraint[] {
    return templateConstraints(
        relationshipTemplate(analysis, options),
        analysis.anchor ?? 0,
    );
}

/** Whether a source is a template (rather than an analysis). */
function isTemplate(
    source: ThemeAnalysis | RelationshipTemplate,
): source is RelationshipTemplate {
    return Array.isArray((source as RelationshipTemplate).slots);
}

/** The arcs an anchor option allows, as hue ranges (none: every hue). */
function anchorRanges(
    anchor: RandomLikeOptions['anchor'],
): readonly HueRange[] {
    if (anchor === undefined || typeof anchor === 'number') {
        return [];
    }
    return Array.isArray(anchor) ? anchor : [anchor as HueRange];
}

/**
 * The anchors (drawn from the ranges) that keep every rotating slot's hue out of `avoid`, unmirrored or
 * mirrored; null when none does.
 */
function clearAnchors(
    ranges: readonly HueRange[],
    offsets: readonly number[],
    avoid: readonly HueRange[],
    mirrored: boolean,
): HueSet | null {
    const blocked: HueRange[] = [];
    for (const { center, width } of avoid) {
        for (const offset of offsets) {
            blocked.push({
                center: center + (mirrored ? offset : -offset),
                width,
            });
        }
    }
    return huesWithout(ranges, blocked);
}

/**
 * Draws a palette in the same hue relationship as a theme (from its analysis, or a template), at a new
 * anchor hue, optionally mirrored: same shape, other hues.
 *
 * Each attempt draws the anchor (one call to random, unless it is a fixed hue), then whether to mirror (one
 * call, if mirror is allowed), then one color per slot, within templateConstraints for that placement, in
 * slot order. Each color is kept deltaEThreshold from the one before it, and the last from the first as
 * well, as the wheel closes there (best effort, as for any random color). The palette is then analyzed
 * with the source's options: an attempt whose relationship and number of groups match the source's is
 * returned, verified. After `attempts` without one, the closest (the same relationship if any attempt had
 * it, then the nearest number of groups; the earliest of equals) is returned, with verified false.
 *
 * With `avoid`, a drawn anchor never puts a rotating slot's hue inside the avoided hues, unless every anchor
 * allowed would; with a fixed anchor, mirroring is chosen to keep them out where it can. An analysis is
 * turned into a template with a base half-width of 8° (and nColors). A neutral source's slots never rotate:
 * they are drawn in place, and verified.
 *
 * The result is a pure function of the inputs and random.
 */
export function randomLike(
    source: ThemeAnalysis | RelationshipTemplate,
    {
        random = Math.random,
        minBrightness,
        deltaEThreshold = DEFAULT_DELTA_E_THRESHOLD,
        anchor,
        mirror = true,
        avoid = [],
        attempts = DEFAULT_ATTEMPTS,
        nColors,
    }: RandomLikeOptions = {},
): RandomLikeResult {
    const template = isTemplate(source)
        ? source
        : relationshipTemplate(source, { hueWidth: LIKE_HUE_WIDTH, nColors });
    const options = analyzeOptions(template.options);
    const floor =
        typeof minBrightness === 'number' && !Number.isNaN(minBrightness)
            ? minBrightness
            : options.minBrightness;
    const tries = slotCount(attempts, 1, DEFAULT_ATTEMPTS);
    const n = template.slots.length;

    const drawColors = (constraints: ColorConstraint[]) => {
        const colors: Color[] = [];
        for (let i = 0; i < n; i++) {
            const awayFrom =
                i === 0
                    ? []
                    : i === n - 1 && n > 2
                      ? [colors[i - 1]!, colors[0]!]
                      : [colors[i - 1]!];
            colors.push(
                randomColor({
                    random,
                    minBrightness: floor,
                    constraint: constraints[i],
                    awayFrom,
                    deltaEThreshold,
                }),
            );
        }
        return colors;
    };

    const offsets = template.slots
        .map((slot) => slot.offset)
        .filter((offset): offset is number => offset !== null);
    const fixed =
        typeof anchor === 'number'
            ? wrapHue(Number.isFinite(anchor) ? anchor : 0)
            : undefined;

    if (offsets.length === 0) {
        // nothing rotates: the slots are drawn in place
        const constraints = templateConstraints(template, fixed ?? 0);
        return {
            colors: drawColors(constraints),
            anchor: fixed ?? 0,
            mirrored: false,
            constraints,
            relationship: template.relationship,
            verified: true,
        };
    }

    const ranges = anchorRanges(anchor);
    const clear = clearAnchors(ranges, offsets, avoid, false);
    const clearMirrored = mirror
        ? clearAnchors(ranges, offsets, avoid, true)
        : null;
    const anchors =
        clear && clearMirrored
            ? unionHues(clear, clearMirrored)
            : (clear ?? clearMirrored ?? huesWithout(ranges, [])!);
    const isClear = (set: HueSet | null, hue: number) =>
        set !== null && distanceToHues(set, hue) === 0;

    let best: (RandomLikeResult & { score: number }) | undefined;
    for (let attempt = 0; attempt < tries; attempt++) {
        const at = fixed ?? wrapHue(hueAlong(anchors, random()));
        let mirrored = false;
        if (mirror) {
            const u = random();
            const plain = isClear(clear, at);
            const flipped = isClear(clearMirrored, at);
            mirrored = plain === flipped ? u < 0.5 : flipped;
        }
        const constraints = templateConstraints(template, at, {
            mirrored,
            avoid,
        });
        const colors = drawColors(constraints);
        const analysis = analyzeTheme(colors, options);
        const verified =
            analysis.relationship === template.relationship &&
            analysis.groups.length === template.groups.length;
        const result = {
            colors,
            anchor: at,
            mirrored,
            constraints,
            relationship: analysis.relationship,
            verified,
        };
        if (verified) {
            return result;
        }
        const score =
            (analysis.relationship === template.relationship ? 0 : 1000) +
            Math.abs(analysis.groups.length - template.groups.length);
        if (!best || score < best.score) {
            best = { ...result, score };
        }
    }
    const { score: _score, ...closest } = best!;
    return closest;
}
