# colormotion

`colormotion` is a JavaScript library of utilities for creating dynamic color palettes.
Its primary use case is for generating color palettes that change over time,
such as for animations or visualizations in LED art. It is built on top of the
fantastic [chroma.js](https://gka.github.io/chroma.js/) library.

It supports many different color interpolation methods:

- RGB
- LAB
- LRGB
- HSL
- LCH
- HSV
- HSI
- HCL

## Installation

```bash
npm install colormotion
```

## Usage

```javascript
const { Theme } = require('colormotion');

const theme = new Theme({
    colors: ['red', 'green', 'blue'],
    nSteps: 2048,
    mode: 'rgb',
});

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

Or with TypeScript:

```typescript
import { Theme } from 'colormotion';
```

Easily set a new color palette, to which the theme will gradually transition.

```javascript
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

Easily change the interpolation mode, to which the theme will gradually transition.

```javascript
// Set the interpolation mode to LAB
theme.setMode('lab');

// Rotate the interpolation mode
theme.rotateMode();
```

Update all options at once while still smoothly transitioning.

```javascript
theme.update({
    colors: ['red', 'green', 'blue'],
    nSteps: 2048,
    mode: 'rgb',
});
```

Set the overall brightness of the theme (0 to 255).

```javascript
theme.brightness = 128;
```

## Seen in the Wild

- [Dumpy Fuego @ Burning Man](https://www.dumpster.life/)
