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

It uses the [chroma.js](https://gka.github.io/chroma.js/) library under the hood for color interpolation.

Check out the interactive docs [here](https://neeler.github.io/colormotion/).

![tests workflow](https://github.com/neeler/colormotion/actions/workflows/tests.yml/badge.svg)
![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/colormotion)

[![npm stats](https://nodei.co/npm/colormotion.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/colormotion/)

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

```typescript
theme.update({
    colors: ['red', 'green', 'blue'],
    nSteps: 2048,
    mode: 'rgb',
});
```

Set the overall brightness of the theme (0 to 255).

```typescript
theme.brightness = 128;
```

## Seen in the Wild

- [Dumpy Fuego @ Burning Man](https://www.dumpster.life/)
