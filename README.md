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

// Rotate a new color into the palette and drop the oldest color
theme.rotateColor('#17a398');

// Rotate a new random color into the palette and drop the oldest color
theme.rotateRandomColor();
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

Supply your own random number generator (any function returning a number
in `[0, 1)`) to get reproducible random palettes, for example from a seeded
PRNG:

```typescript
const theme = new Theme({
    nColors: 5,
    random: seededRandom(42),
});
```

## Development

```bash
npm test          # unit tests (watch mode)
npm run bench     # benchmarks: palette building, getColor, transition ticks, LED frames
```

To check a change for speed, save a baseline on `main` and compare your branch against it (the file is written under `tests/`):

```bash
git switch main && npm run bench -- --outputJson bench-main.json
git switch my-branch && npm run bench -- --compare bench-main.json
```

## Seen in the Wild

- [Dumpy Fuego @ Burning Man](https://www.dumpster.life/)
