import chroma, { Color } from 'chroma-js';
import type { RandomFunction } from './ColorPalette';
import { clamp } from './clamp';
import type { ColorConstraint, ColorConstraints } from './constraints';
import { colorFromHue } from './gamut';
import { allowedHues, chromaBounds, hueAlong } from './hueArcs';

/*
 * The random draws behind ColorPalette's random methods and randomColor.
 */

/**
 * Maximum number of candidates drawn when searching for a random color
 * that satisfies the deltaE threshold. If none qualifies, the most
 * distant candidate is used.
 */
const MAX_RANDOM_COLOR_ATTEMPTS = 100;

/**
 * Draws a random color with a brightness (HSV value) of at least minBrightness: uniform in HSV, as every
 * random method drew colors in 4.0. Three calls to random: value, hue and saturation.
 */
export function randomHsvColor(random: RandomFunction, minBrightness = 0) {
    const brightness = clamp(
        random() * (1 - minBrightness) + minBrightness,
        0,
        1,
    );

    return chroma({
        h: random() * 360,
        s: random(),
        v: brightness,
    });
}

/**
 * A function that draws one random color: with no constraint, randomHsvColor; with one, a color that meets
 * it, drawn from three calls to random, in the order randomHsvColor makes them: its brightness (HSV value,
 * uniform from minBrightness to 1, as in randomHsvColor), its OKLCH hue (uniform over the hues the constraint
 * allows) and its relative chroma (uniform within the constraint's range). The constraint is read once, here.
 */
export function colorDraw(
    constraint: ColorConstraint | undefined,
): (random: RandomFunction, minBrightness?: number) => Color {
    if (!constraint) {
        return randomHsvColor;
    }
    const hues = allowedHues(constraint);
    const [minChroma, maxChroma] = chromaBounds(constraint.chroma);
    return (random, minBrightness = 0) => {
        const floor = Number.isNaN(minBrightness) ? 0 : minBrightness;
        const brightness = clamp(random() * (1 - floor) + floor, 0, 1);
        const hue = hueAlong(hues, random());
        const fraction = minChroma + random() * (maxChroma - minChroma);
        return colorFromHue({ hue, brightness, chroma: fraction });
    };
}

/**
 * Draws one random color, as colorDraw(constraint) does.
 */
export function drawColor(
    constraint: ColorConstraint | undefined,
    random: RandomFunction,
    minBrightness?: number,
) {
    return colorDraw(constraint)(random, minBrightness);
}

/**
 * The constraint for a position in a palette: the one constraint given for every color, or the entry for
 * the position in a list of them (a missing entry counts as {}, no limit, so the color is still drawn in
 * OKLCH). undefined when there are no constraints: the color is drawn in HSV, as in 4.0.
 */
export function constraintAt(
    constraints: ColorConstraints | undefined,
    position: number,
): ColorConstraint | undefined {
    if (constraints == null) {
        return undefined;
    }
    if (isList(constraints)) {
        return constraints[position] ?? {};
    }
    return constraints;
}

function isList(
    constraints: ColorConstraints,
): constraints is readonly (ColorConstraint | undefined)[] {
    return Array.isArray(constraints);
}

/**
 * A call's candidateBudget being spent (see RandomLikeOptions.candidateBudget), shared by every color the
 * call draws.
 */
export interface Budget {
    /** Candidates left beyond each color's first, for the rest of the call. */
    left: number;
    /** Of left, the candidates this round (a palette, or one attempt of randomLike) may still use. */
    roundLeft: number;
    /** The colors this round still draws, each with an even share of roundLeft; 0: no round. */
    roundColors: number;
}

/**
 * A candidateBudget option as a Budget: a number other than NaN starts a budget of max(0, floor(value))
 * candidates (Infinity stays Infinity). undefined (no budget: the 4.2 search) when it is not a number or is
 * NaN.
 */
export function budgetOf(candidates: number | undefined): Budget | undefined {
    if (typeof candidates !== 'number' || Number.isNaN(candidates)) {
        return undefined;
    }
    return {
        left: Math.max(0, Math.floor(candidates)),
        roundLeft: 0,
        roundColors: 0,
    };
}

/**
 * Starts a round of a budget: `colors` colors share `share` (0–1) of what is left, evenly. A color that uses
 * less than its share leaves the rest to the colors after it; what the round does not use stays for the
 * rounds after it.
 */
export function startRound(budget: Budget, colors: number, share = 1) {
    budget.roundLeft = Math.floor(budget.left * share);
    budget.roundColors = Math.max(0, colors);
}

/**
 * Draws a random color at least deltaEThreshold away from every one of the neighbours, within the
 * constraint if one is given. Gives up after a bounded number of attempts and returns the candidate
 * furthest from its nearest neighbour, so a strict threshold can never hang. With no neighbours, the
 * first candidate is the color.
 *
 * With a budget, the candidates are the same, in the same order, but the search looks at no more than
 * 1 + its allowance of them: an even share of what is left of the round, or of the budget when there is no
 * round (and never more than 100). It stops at the first candidate that reaches deltaEThreshold, as without
 * a budget, or returns the furthest it looked at (the earliest of equals), and spends what it drew beyond the
 * first. It differs from the search without a budget only by stopping sooner, and in two edge cases: with no
 * neighbours it draws the first candidate only, whatever the threshold (without a budget, a NaN threshold
 * draws all 100 and keeps the first), and when every distance is NaN it returns the first candidate (without
 * a budget, a 101st is drawn).
 */
export function drawAwayFrom(
    neighbours: Color[],
    {
        minBrightness = 0,
        deltaEThreshold = 0,
        random = Math.random,
        constraint,
        budget,
    }: {
        minBrightness?: number;
        deltaEThreshold?: number;
        random?: RandomFunction;
        constraint?: ColorConstraint;
        budget?: Budget;
    } = {},
) {
    const draw = colorDraw(constraint);
    if (budget) {
        return drawAwayFromWithin(neighbours, {
            draw,
            minBrightness,
            deltaEThreshold,
            random,
            budget,
        });
    }
    let bestColor: Color | undefined;
    let bestDistance = -Infinity;

    for (let attempt = 0; attempt < MAX_RANDOM_COLOR_ATTEMPTS; attempt++) {
        const candidate = draw(random, minBrightness);
        let distance = Infinity;
        for (const neighbour of neighbours) {
            distance = Math.min(
                distance,
                chroma.deltaE(neighbour, candidate, 1, 1, 1),
            );
        }

        if (distance >= deltaEThreshold) {
            return candidate;
        }
        if (distance > bestDistance) {
            bestColor = candidate;
            bestDistance = distance;
        }
    }

    return bestColor ?? draw(random, minBrightness);
}

/** drawAwayFrom with a budget: the first candidates of the search without one, as many as the budget allows. */
function drawAwayFromWithin(
    neighbours: Color[],
    {
        draw,
        minBrightness,
        deltaEThreshold,
        random,
        budget,
    }: {
        draw: (random: RandomFunction, minBrightness?: number) => Color;
        minBrightness: number;
        deltaEThreshold: number;
        random: RandomFunction;
        budget: Budget;
    },
) {
    const allowance =
        budget.roundColors > 0
            ? Math.floor(budget.roundLeft / budget.roundColors)
            : budget.left;
    const cap = Math.max(1, Math.min(MAX_RANDOM_COLOR_ATTEMPTS, 1 + allowance));
    let firstColor: Color | undefined;
    let bestColor: Color | undefined;
    let bestDistance = -Infinity;
    let drawn = 0;
    let result: Color | undefined;

    while (drawn < cap) {
        const candidate = draw(random, minBrightness);
        drawn++;
        firstColor ??= candidate;
        if (neighbours.length === 0) {
            // nothing to keep from: the first candidate, whatever the threshold
            result = candidate;
            break;
        }
        let distance = Infinity;
        for (const neighbour of neighbours) {
            distance = Math.min(
                distance,
                chroma.deltaE(neighbour, candidate, 1, 1, 1),
            );
        }

        if (distance >= deltaEThreshold) {
            result = candidate;
            break;
        }
        if (distance > bestDistance) {
            bestColor = candidate;
            bestDistance = distance;
        }
    }

    const spent = drawn - 1;
    budget.left = Math.max(0, budget.left - spent);
    if (budget.roundColors > 0) {
        budget.roundLeft = Math.max(0, budget.roundLeft - spent);
        budget.roundColors--;
    }
    // every distance NaN: the first candidate (without a budget, one more is drawn)
    return result ?? bestColor ?? firstColor!;
}
