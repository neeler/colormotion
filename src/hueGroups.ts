import chroma, { Color } from 'chroma-js';
import type { ColorInput } from './ColorPalette';
import type { AnalyzeOptions, Relationship } from './analyze';
import { clamp } from './clamp';
import { safeMod } from './safeMod';

/*
 * The arithmetic behind analyzeTheme and the relationship templates: hues around the circle, chains of
 * hues, and how groups of hues relate.
 */

/** The analysis thresholds when none are given. */
const DEFAULT_ANALYZE_OPTIONS: Required<AnalyzeOptions> = {
    minBrightness: 0,
    neutralChroma: 0.12,
    structuralChroma: 0.75,
    familyJoin: 30,
    attachWithin: 45,
    contrastFrom: 90,
    duplicateDeltaE: 3,
};

/**
 * The options with defaults filled in: each value that is not a finite number takes its default, and each is
 * kept to a sensible range (brightness and chroma 0 to 1, angles 0 to 360, distances 0 or more).
 */
export function analyzeOptions(
    options: AnalyzeOptions = {},
): Required<AnalyzeOptions> {
    const value = (key: keyof AnalyzeOptions, min: number, max: number) => {
        const given = options[key];
        return typeof given === 'number' && Number.isFinite(given)
            ? clamp(given, min, max)
            : DEFAULT_ANALYZE_OPTIONS[key];
    };
    return {
        minBrightness: value('minBrightness', 0, 1),
        neutralChroma: value('neutralChroma', 0, 1),
        structuralChroma: value('structuralChroma', 0, 1),
        familyJoin: value('familyJoin', 0, 360),
        attachWithin: value('attachWithin', 0, 360),
        contrastFrom: value('contrastFrom', 0, 360),
        duplicateDeltaE: value('duplicateDeltaE', 0, Infinity),
    };
}

/** Degrees wrapped into [0, 360), with no negative zero. */
export function wrapHue(degrees: number) {
    const wrapped = safeMod(degrees, 360);
    // a hair under 0 wraps to 360 in floating point
    return (wrapped >= 360 ? 0 : wrapped) + 0;
}

/** The signed distance from one hue to another: over −180, up to 180. */
export function hueOffset(from: number, to: number) {
    const d = wrapHue(to - from);
    return d > 180 ? d - 360 : d;
}

/** The distance between two hues around the circle, 0 to 180. */
export function hueDistance(a: number, b: number) {
    return Math.abs(hueOffset(a, b));
}

/** A hue and a weight, to be chained into groups. */
export interface Linked {
    index: number;
    hue: number;
    weight: number;
}

/** A chain of hues: its members in hue order, each at its position along the chain (not wrapped). */
export interface Chain {
    members: Linked[];
    positions: number[];
}

/**
 * Single linkage around the circle: the hues in order, cut at every gap of `join` degrees or more. With no
 * such gap, one chain, starting after the largest gap. The chains come in hue order.
 */
export function link(items: readonly Linked[], join: number): Chain[] {
    if (items.length === 0) {
        return [];
    }
    const sorted = [...items].sort(
        (a, b) => a.hue - b.hue || a.index - b.index,
    );
    const n = sorted.length;
    const gaps = sorted.map((item, k) =>
        n === 1 ? 360 : wrapHue(sorted[(k + 1) % n]!.hue - item.hue),
    );
    let cuts: number[] = [];
    gaps.forEach((gap, k) => {
        if (gap >= join) cuts.push(k);
    });
    if (cuts.length === 0) {
        // no gap is wide enough: one chain around the circle, from after its largest gap
        cuts = [gaps.indexOf(Math.max(...gaps))];
    }
    return cuts.map((cut, c) => {
        const end = cuts[(c + 1) % cuts.length]!;
        const members: Linked[] = [];
        const positions: number[] = [];
        let position = 0;
        for (let k = cut + 1; ; k++) {
            const item = sorted[k % n]!;
            position =
                members.length === 0 ? item.hue : position + gaps[(k - 1) % n]!;
            members.push(item);
            positions.push(position);
            if (k % n === end) break;
        }
        return { members, positions };
    });
}

/** The weighted mean of a chain's positions (not wrapped). */
export function chainCenter({ members, positions }: Chain) {
    let sum = 0;
    let total = 0;
    members.forEach((member, k) => {
        sum += member.weight * positions[k]!;
        total += member.weight;
    });
    return total > 0 ? sum / total : positions[0]!;
}

/**
 * The relationship of hue groups with these centers (in degrees), and the arc they occupy: 360 less the
 * largest gap between centers, or for a single group its own span.
 */
export function classifyGroups(
    groups: readonly { center: number; span: number }[],
    contrastFrom: number,
): { relationship: Relationship; span: number } {
    const k = groups.length;
    if (k === 0) {
        return { relationship: 'neutral', span: 0 };
    }
    if (k === 1) {
        return { relationship: 'family', span: groups[0]!.span };
    }
    const centers = groups
        .map((group) => wrapHue(group.center))
        .sort((a, b) => a - b);
    const gaps = centers.map((center, i) =>
        i === k - 1 ? 360 - center + centers[0]! : centers[i + 1]! - center,
    );
    const largest = Math.max(...gaps);
    const span = 360 - largest;
    if (k === 2) {
        return {
            relationship:
                hueDistance(centers[0]!, centers[1]!) < contrastFrom
                    ? 'accent'
                    : 'contrast',
            span,
        };
    }
    if (k === 3) {
        if (largest >= 180) {
            return {
                relationship: span >= contrastFrom ? 'bridge' : 'family',
                span,
            };
        }
        return {
            relationship:
                Math.min(...gaps) >= contrastFrom ? 'triad' : 'pair-accent',
            span,
        };
    }
    return { relationship: 'spectrum', span };
}

/**
 * A color lifted to a brightness (HSV value) as measureColor lifts it, its channels scaled together (black
 * lifts to grey), at full precision. Alpha is dropped.
 */
export function liftColor(color: ColorInput, minBrightness: number): Color {
    const [r, g, b] = chroma(color)
        .rgb(false)
        .map((channel) => channel / 255) as [number, number, number];
    const value = Math.max(r, g, b);
    if (value >= minBrightness) {
        return chroma.gl(r, g, b, 1);
    }
    if (value > 0) {
        const scale = minBrightness / value;
        return chroma.gl(r * scale, g * scale, b * scale, 1);
    }
    return chroma.gl(minBrightness, minBrightness, minBrightness, 1);
}
