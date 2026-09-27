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
 * Draws a random color at least deltaEThreshold away from every one of the neighbours, within the
 * constraint if one is given. Gives up after a bounded number of attempts and returns the candidate
 * furthest from its nearest neighbour, so a strict threshold can never hang. With no neighbours, the
 * first candidate is the color.
 */
export function drawAwayFrom(
    neighbours: Color[],
    {
        minBrightness = 0,
        deltaEThreshold = 0,
        random = Math.random,
        constraint,
    }: {
        minBrightness?: number;
        deltaEThreshold?: number;
        random?: RandomFunction;
        constraint?: ColorConstraint;
    } = {},
) {
    const draw = colorDraw(constraint);
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
