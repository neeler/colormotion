# colormotion

`colormotion` is a JavaScript library that generates dynamic color palettes.
Its primary use case is for generating color palettes that change over time,
such as for animations or visualizations in LED art.

Compatible with Node.js and browser environments.

It supports many different color interpolation methods:

- RGB
- LAB
- LRGB
- HSL
- LCH
- HSV
- HSI
- HCL
- OKLab
- OKLCH

It uses the [chroma.js](https://gka.github.io/chroma.js/) library under the hood for color interpolation.

Check out the interactive docs [here](https://neeler.github.io/colormotion/).

![tests workflow](https://github.com/neeler/colormotion/actions/workflows/tests.yml/badge.svg)
![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/colormotion)

[![npm stats](https://nodei.co/npm/colormotion.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/colormotion)

## Installation

Install the `colormotion` npm module using your favorite package manager:

```bash
npm install colormotion
# or
# pnpm install colormotion
# or
# yarn add colormotion
```

## Quick Start

Import the `Theme` class from `colormotion` using CommonJS or ES modules:

```typescript
// CommonJS
const { Theme } = require('colormotion');

// ES modules
import { Theme } from 'colormotion';
```

Create a new theme instance:

```typescript
const theme = new Theme();
```

Create a new theme instance with 5 random colors:

```typescript
const theme = new Theme({
    nColors: 5,
});
```

Create a new theme instance with 5 random colors and 1024 steps:

```typescript
const theme = new Theme({
    nColors: 5,
    nSteps: 1024,
});
```

Create a new theme instance with specific colors:

```typescript
const theme = new Theme({
    colors: ['red', 'green', 'blue'],
});
```

Supposing we have some draw loop, we can use the theme to generate colors for our LEDs:

```typescript
function draw() {
    // Suppose we have an LED strip with 100 LEDs
    for (let i = 0; i < 100; i++) {
        const color = theme.getColor(i);
        // Set the color of the i-th LED to `color`
    }

    // Advance the theme to the next frame
    theme.tick();
}
```

Easily set a new color palette, to which the theme will gradually transition.

```typescript
// Set an entirely new color palette
theme.setColors(['red', 'green', 'blue']);

// Set a new color palette using an input color as a seed
theme.randomFrom('#662c91');

// Set a completely random palette
theme.randomTheme();

// Replace the oldest color with a new color, in its place on the wheel
theme.rotateColor('#17a398');

// Replace the oldest color with a new random color
theme.rotateRandomColor();
```

Rotating replaces one color in place: every other color keeps its place on the wheel, so only the colors
between the replaced color's two neighbours change, and an LED that shows another part of the wheel keeps
its color. Successive rotations replace the colors oldest first, starting from the first color of the list
they were set from. `activePalette.ageOrder` lists the positions of the colors, oldest first, so its first
entry is the color the next rotation replaces.

```typescript
const theme = new Theme({ colors: ['red', 'green', 'blue'] });
theme.rotateColor('purple'); // purple, green, blue
theme.rotateColor('orange'); // purple, orange, blue
theme.activePalette.ageOrder; // [2, 0, 1]: blue is next
```

Change the interpolation mode, generating a different set of intermediary colors,
to which the theme will gradually transition.

```typescript
// Set the interpolation mode to LAB
theme.setMode('lab');

// Rotate the interpolation mode
theme.rotateMode();
```

Update all options at once while still smoothly transitioning.
The mode is optional and defaults to the current mode.

```typescript
theme.update({
    colors: ['red', 'green', 'blue'],
    mode: 'rgb',
});
```

To end a transition at a set time, give its length in ticks with `transitionDuration`.
The colors ease in and out and become exactly the new palette on the last tick.
Durations count calls to `tick()`, so they follow the frame rate.

```typescript
// Transition over exactly 360 ticks: 6 seconds at 60 ticks per second
theme.setColors(['red', 'green', 'blue'], { transitionDuration: 6 * 60 });

// Advance the transition without rotating the color wheel
theme.tick(0);

// Apply a palette at once
theme.setColors(['black'], { transitionDuration: 0 });

// Check for, or finish, a transition in progress
if (theme.isTransitioning) {
    theme.finishTransition();
}
```

A duration of 0 applies the palette before the call returns, notifying subscribers once. A value that is
not a finite number is ignored, and `transitionSpeed` applies instead.

Sending the same duration again for the palette the theme is already transitioning to changes nothing,
so an update can be re-sent every frame. A different duration re-times the transition to end that many
ticks from now, continuing from the current colors. A re-time, like a new target, starts the easing
again from rest, so re-send the same duration rather than a countdown of the ticks left.
`transitionSpeed` suits targets that change continuously.

Set the overall brightness of the theme (0 to 1).

```typescript
theme.brightness = 0.6;
```

By default, brightness darkens colors in CIELAB space, so colors keep some
luminance even at brightness 0. For LEDs you may prefer linear brightness,
where 0 turns the LEDs off and 0.5 is half output:

```typescript
const theme = new Theme({
    colors: ['red', 'green', 'blue'],
    brightnessMode: 'linear',
});
```

To sample the whole color wheel into a float array on every frame, for a lookup table or an LED
pipeline, use `fillRgb`. It writes the red, green and blue of every step, three numbers per color, and
creates no color objects. The values are exactly those of `getColor(i).rgb(false)` divided by 255, so
the color index, a transition in progress and the brightness apply as they do in `getColor`. Pass
`max: 255` for the 0-255 values.

```typescript
const lut = new Float32Array(theme.nSteps * 3);

function draw() {
    theme.fillRgb(lut, { brightness: 0.8 });
    // lut[3 * i], lut[3 * i + 1] and lut[3 * i + 2] are the red, green and blue
    // of theme.getColor(i, { brightness: 0.8 }), from 0 to 1
    theme.tick();
}
```

Supply your own random number generator (any function returning a number
in `[0, 1)`) to get reproducible random palettes, for example from a seeded
PRNG:

```typescript
const theme = new Theme({
    nColors: 5,
    random: seededRandom(42),
});
```

## Random colors within constraints

Random colors are drawn uniformly in HSV by default: any hue, any saturation, and a brightness (HSV value)
from `minBrightness` to 1. Uniform HSV hue is uneven to the eye, though: about 22 % of fully saturated draws
land in the greens between OKLCH hues 120° and 150°, and about 4 % in each 30° of gold or cyan. Uniform
saturation draws greys and pastels too: at a `minBrightness` of 0.537, about a quarter of draws are under
relative chroma 0.35.

Pass `constraints` to any random method to draw in OKLCH terms instead: the hue uniform over the OKLCH hues
allowed, the relative chroma uniform within a range, and the brightness uniform from `minBrightness` to 1,
as before. Relative chroma is a color's OKLCH chroma as a fraction of the most sRGB allows at its hue and
brightness, so every value from 0 (grey) to 1 (as saturated as sRGB gets) is a color at every hue. Every
color drawn meets its constraint.

```typescript
import { hueArc } from 'colormotion';

// No greys or pastels, and no olive or lime
theme.randomTheme({
    minBrightness: 0.5,
    constraints: { chroma: { min: 0.5 }, avoid: [hueArc(95, 135)] },
});
```

A constraint has three optional parts:

- `hues`: arcs of OKLCH hue, `{ center, width }` with the full width in degrees, or `hueArc(from, to)`, the
  arc running up from one hue to the other (`hueArc(330, 30)` is the reds from 330° through 0° to 30°).
  Left out, every hue.
- `avoid`: arcs taken out of `hues`. They are ignored if they would leave no hue, so a color can always be
  drawn.
- `chroma`: `{ min, max }`, the relative chroma allowed, from 0 to 1.

`constraints` is one constraint for every color, or a list with one for each position in the palette.
`randomTheme` and `new Theme({ nColors, constraints })` draw the color at position `i` within
`constraints[i]`; `randomFrom` keeps its seed at position 0 as it is and draws the rest from position 1;
`pushRandomColor` draws within the constraint for the position it adds; and `rotateRandomColor` within the
constraint for the position it replaces (the oldest, `activePalette.ageOrder[0]`). So a palette built from a
few picks can roll one color at a time and keep each color near its pick:

```typescript
import { Theme, measureColor } from 'colormotion';

const theme = new Theme({
    colors: ['#e8b450', '#7a1a2b', '#2b8f6b'],
    mode: 'oklch',
});
const nearEachPick = theme.activePaletteHexes.map((hex) => {
    const { hue, chroma } = measureColor(hex);
    return {
        hues: hue === null ? [] : [{ center: hue, width: 24 }], // ± 12°
        chroma: { min: chroma - 0.2, max: chroma + 0.2 },
    };
});

// Replace the oldest color with one near the pick in its position
theme.rotateRandomColor({ constraints: nearEachPick });
```

To draw one color, use `randomColor`. `awayFrom` keeps it at least `deltaEThreshold` (CIEDE2000, 20 by
default) from other colors, as the random methods keep a new color from its neighbours: best effort, up to
100 candidates, then the furthest of them.

```typescript
import { randomColor } from 'colormotion';

const color = randomColor({
    constraint: { hues: [hueArc(20, 60)], chroma: { min: 0.7 } },
    minBrightness: 0.5,
    awayFrom: ['#7a1a2b', '#e8b450'],
    random: seededRandom(42),
});
```

`measureColor(color)` gives a color's OKLCH hue, relative chroma and brightness (`hue` is `null` for greys),
`colorFromHue({ hue, brightness, chroma })` gives the color at those measures, and
`meetsConstraint(color, constraint)` checks a color against a constraint.

Without `constraints` (for `randomColor`, without `constraint`), colors are drawn in HSV exactly as before,
so a seeded `random` draws the same colors as in 4.0.

## Upgrading to 4.0

Rotating a color (`theme.rotateColor`, `theme.rotateRandomColor`, `palette.rotateOn` and
`palette.rotateRandomOn`) replaces the oldest color in its position. Before 4.0, it dropped the first color
and appended the new one, which moved every color one place along the wheel, so every part of the wheel
changed color at once. To keep that behavior, shift the colors yourself:

```typescript
theme.setColors([...theme.activePaletteHexes.slice(1), color]);
// or, for a ColorPalette
palette.newColors([...palette.hexes.slice(1, -1), color]);
```

To shift in a random color, drawn at least `deltaEThreshold` from the last color as before 4.0, drop the
oldest color and push a random one. With the same `random`, this draws the same colors as 3.x did, as long
as the colors are only ever set from lists, pushed or popped (so their ages stay in list order); a palette
of one color gains a second.

```typescript
theme.setColors(theme.activePalette.popOldest().pushRandom().colors);
// or, for a ColorPalette
palette.popOldest().pushRandom();
```

Also changed:

- `popOldestColor` and `popOldest` drop the oldest color by age: the first color unless the palette has
  been rotated.
- `rotateRandomColor` and `rotateRandomOn` draw the new color at least `deltaEThreshold` from both of its
  neighbours on the wheel, not from the last color, so a seeded `random` gives different colors than in 3.x.
- Rotating and popping keep the other colors as they are, at full precision (they were rounded to 8-bit
  hex). Rotating, pushing and popping never take a color that matches the first for the closing repeat of
  the wheel: `pushNewColor` adds such a color, where it used to add nothing, and a rotation or a pop no
  longer loses one.
- A palette can now end on a color that matches its first (rotating blue into red, green, blue gives blue,
  green, blue). `activePaletteHexes` leaves out the closing repeat, so given back as colors, such a list
  loses its last color. To give a palette's colors back as they are, pass `activePalette.hexes` (which ends
  with the closing repeat) or `activePalette.colors`.
- A `palette` passed to the `Theme` constructor that already has the theme's settings is used as it is,
  rather than copied. A copy, as for any other palette, keeps the colors' ages.

## Development

```bash
npm test          # unit tests (watch mode)
npm run bench     # benchmarks: palette building, getColor, fillRgb, transition ticks, LED frames, random draws
npm run docs:api  # regenerate the docs site's API reference (Node 22.18 or later)
```

The docs site shows each method's signature and every exported type, generated from the source into `docs/src/generated/api.json`. A test fails when a public signature or its JSDoc changes until the reference is regenerated.

To check a change for speed, save a baseline on `main` and compare your branch against it (the file is written under `tests/`):

```bash
git switch main && npm run bench -- --outputJson bench-main.json
git switch my-branch && npm run bench -- --compare bench-main.json
```

## Seen in the Wild

- [Dumpy Fuego @ Burning Man](https://www.dumpster.life/)
