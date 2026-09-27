import { clamp } from './clamp';
import type { ChromaRange, ColorConstraint, HueRange } from './constraints';
import { safeMod } from './safeMod';

/*
 * The arithmetic behind ColorConstraint: which hues a constraint allows, a hue along them, and how far a
 * hue lies from them.
 */

/**
 * A set of OKLCH hues: arcs of positive length, or, when every arc a constraint gives has width 0, single
 * hues.
 */
export interface HueSet {
    /** Disjoint arcs [start, end], with 0 ≤ start < end ≤ 360, in order of start. Empty for single hues. */
    arcs: [number, number][];
    /** Single hues, from 0 to 360, used when there are no arcs. */
    points: number[];
}

const EVERY_HUE: HueSet = { arcs: [[0, 360]], points: [] };

/** A constraint's hue ranges, sorted out: every hue, arcs of positive width, and single hues. */
function sortRanges(ranges: readonly HueRange[] | undefined) {
    let everyHue = false;
    const arcs: [number, number][] = [];
    const points: number[] = [];
    for (const { center, width } of ranges ?? []) {
        if (width >= 360) {
            everyHue = true;
        } else if (Number.isNaN(width) || !Number.isFinite(center)) {
            // ignored
        } else if (width > 0) {
            const start = safeMod(center - width / 2, 360);
            const end = start + width;
            if (end <= 360) {
                arcs.push([start, end]);
            } else {
                arcs.push([start, 360], [0, end - 360]);
            }
        } else {
            points.push(safeMod(center, 360));
        }
    }
    return { everyHue, arcs: union(arcs), points: [...new Set(points)] };
}

/** Arcs merged where they overlap or touch, in order of start. */
function union(arcs: [number, number][]) {
    const sorted = [...arcs].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [start, end] of sorted) {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    }
    return merged;
}

/** The parts of the arcs outside every one of the avoided arcs (both disjoint and in order). */
function subtract(arcs: [number, number][], avoid: [number, number][]) {
    const remaining: [number, number][] = [];
    for (const [start, end] of arcs) {
        let from = start;
        for (const [avoidStart, avoidEnd] of avoid) {
            if (avoidEnd <= from || avoidStart >= end) continue;
            if (avoidStart > from) {
                remaining.push([from, avoidStart]);
            }
            from = Math.max(from, avoidEnd);
        }
        if (from < end) {
            remaining.push([from, end]);
        }
    }
    return remaining;
}

/** Whether a hue lies on one of the arcs (ends included). */
function onArcs(arcs: [number, number][], hue: number) {
    return arcs.some(([start, end]) => hue >= start && hue <= end);
}

/**
 * The hues a constraint allows: its hue ranges (every hue when it gives none), less its avoided ranges,
 * unless avoiding them would leave no hue, in which case they are ignored.
 */
export function allowedHues(constraint: ColorConstraint): HueSet {
    const hues = sortRanges(constraint.hues);
    const avoid = sortRanges(constraint.avoid);
    const included: HueSet =
        hues.everyHue || (hues.arcs.length === 0 && hues.points.length === 0)
            ? EVERY_HUE
            : { arcs: hues.arcs, points: hues.arcs.length ? [] : hues.points };

    if (avoid.everyHue) {
        // it would leave no hue
        return included;
    }
    if (included.arcs.length > 0) {
        const arcs = subtract(included.arcs, avoid.arcs);
        return arcs.length > 0 ? { arcs, points: [] } : included;
    }
    const points = included.points.filter(
        (point) => !onArcs(avoid.arcs, point) && !avoid.points.includes(point),
    );
    return points.length > 0 ? { arcs: [], points } : included;
}

/**
 * The hue a fraction u (0 to 1) of the way along the set: its arcs laid end to end, so a uniform u gives a
 * uniform hue, or its single hues, each with an equal share of u.
 */
export function hueAlong({ arcs, points }: HueSet, u: number) {
    if (arcs.length === 0) {
        return points[
            clamp(Math.floor(u * points.length), 0, points.length - 1)
        ]!;
    }
    const total = arcs.reduce((sum, [start, end]) => sum + (end - start), 0);
    let along = u * total;
    for (const [start, end] of arcs) {
        if (along < end - start) {
            return start + along;
        }
        along -= end - start;
    }
    return safeMod(arcs[arcs.length - 1]![1], 360);
}

/** The distance in degrees between two hues, around the circle (0 to 180). */
function hueDistance(a: number, b: number) {
    const d = safeMod(a - b, 360);
    return Math.min(d, 360 - d);
}

/** How far in degrees a hue lies from the set: 0 on it. */
export function distanceToHues({ arcs, points }: HueSet, hue: number) {
    const h = safeMod(hue, 360);
    if (arcs.length === 0) {
        return Math.min(...points.map((point) => hueDistance(h, point)));
    }
    if (onArcs(arcs, h)) {
        return 0;
    }
    let nearest = 180;
    for (const [start, end] of arcs) {
        nearest = Math.min(nearest, hueDistance(h, start), hueDistance(h, end));
    }
    return nearest;
}

/** A chroma range's bounds: each clamped to 0–1 (0 and 1 when not given or NaN), the lower first. */
export function chromaBounds(range: ChromaRange | undefined): [number, number] {
    const bound = (value: number | undefined, otherwise: number) =>
        value === undefined || Number.isNaN(value)
            ? otherwise
            : clamp(value, 0, 1);
    const min = bound(range?.min, 0);
    const max = bound(range?.max, 1);
    return min <= max ? [min, max] : [max, min];
}
