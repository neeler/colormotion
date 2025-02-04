// src/Theme.ts
import chroma2 from "chroma-js";

// src/ColorPalette.ts
import chroma from "chroma-js";

// src/InterpolationMode.ts
var InterpolationModes = {
  rgb: "rgb",
  lab: "lab",
  lrgb: "lrgb",
  hsl: "hsl",
  lch: "lch",
  hsv: "hsv",
  hsi: "hsi",
  hcl: "hcl"
};
var InterpolationModeArray = [
  InterpolationModes.rgb,
  InterpolationModes.lab,
  InterpolationModes.lrgb,
  InterpolationModes.hsl,
  InterpolationModes.lch,
  InterpolationModes.hsv,
  InterpolationModes.hsi,
  InterpolationModes.hcl
];
function getNextInterpolationMode(mode) {
  const index = InterpolationModeArray.indexOf(mode);
  return InterpolationModeArray[(index + 1) % InterpolationModeArray.length];
}

// src/ColorPalette.ts
var ColorPalette = class _ColorPalette {
  constructor({
    colors,
    mode,
    nSteps,
    normalizedColors,
    deltaEThreshold
  }) {
    this.maxNumberOfColors = 8;
    this.mode = mode;
    this.nSteps = nSteps;
    this.colors = normalizedColors ?? _ColorPalette.normalizeColors(colors);
    this.nColors = this.colors.length - 1;
    this.hexes = this.colors.map((c) => c.hex());
    this.key = this.hexes.join(":");
    this.scale = chroma.scale(this.colors).mode(mode).domain([0, nSteps]).out(null);
    const scaleColors = this.scale.colors(nSteps + 1).map((c) => chroma(c));
    scaleColors.pop();
    this.scaleColors = scaleColors;
    this.deltaEThreshold = deltaEThreshold ?? 20;
  }
  /**
   * Normalizes the input colors to chroma-js colors.
   */
  static normalizeColors(colorInputs) {
    const colors = colorInputs.map((value) => chroma(value));
    const firstColor = colors[0] ?? chroma("green");
    colors[0] = firstColor;
    const firstHex = firstColor.hex();
    const lastHex = colors[colors.length - 1]?.hex();
    if (colors.length > 1 && firstHex === lastHex) {
      colors.pop();
    }
    colors.push(firstColor);
    return colors;
  }
  static analyzeColors(colors) {
    const normalizedColors = _ColorPalette.normalizeColors(colors);
    const key = normalizedColors.map((c) => c.hex()).join(":");
    return {
      key,
      normalizedColors
    };
  }
  /**
   * Creates a new palette with the specified configuration.
   */
  newConfig({
    colors,
    nSteps,
    mode
  }) {
    const modeIsSame = mode === this.mode;
    const nStepsIsSame = nSteps === this.nSteps;
    if (modeIsSame && nStepsIsSame) {
      return this.newColors(colors);
    }
    const { key, normalizedColors } = _ColorPalette.analyzeColors(colors);
    const colorsAreSame = key === this.key;
    if (nStepsIsSame && colorsAreSame) {
      return this.newMode(mode);
    }
    return new _ColorPalette({
      mode,
      nSteps,
      normalizedColors
    });
  }
  /**
   * Gets a new palette with new colors but the same mode.
   */
  newColors(colors) {
    const { key, normalizedColors } = _ColorPalette.analyzeColors(colors);
    if (key === this.key) {
      return this;
    }
    return new _ColorPalette({
      mode: this.mode,
      nSteps: this.nSteps,
      normalizedColors
    });
  }
  /**
   * Gets a new palette with the same colors but a different mode.
   */
  newMode(mode) {
    if (mode === this.mode) {
      return this;
    }
    return new _ColorPalette({
      colors: this.colors,
      mode,
      nSteps: this.nSteps
    });
  }
  /**
   * Gets a new palette with the same colors but the next mode.
   */
  rotateMode() {
    return this.newMode(getNextInterpolationMode(this.mode));
  }
  /**
   * Randomizes the palette starting with the input color.
   *
   * @param seed The color to start with.
   * @param options Options for randomizing the palette.
   * @param options.minBrightness The minimum brightness for the colors.
   * @returns A new palette with randomized colors.
   */
  randomizeFrom(seed, {
    minBrightness = 0
  } = {}) {
    let lastColor = seed;
    const colors = [seed];
    let attempts = 0;
    while (colors.length < this.nColors && attempts < 10) {
      const possibleColor = chroma.random();
      if (chroma.deltaE(lastColor, possibleColor, 1, 1, 1) > this.deltaEThreshold && possibleColor.get("hsv.v") > minBrightness) {
        colors.push(possibleColor);
        lastColor = possibleColor;
      }
      attempts += 1;
    }
    while (colors.length < this.nColors) {
      colors.push(chroma.random());
    }
    return this.newColors(colors);
  }
  /**
   * Randomizes the whole palette with a random number of colors.
   */
  randomize(nColors = Math.floor(Math.random() * 3 + 3)) {
    let lastColor = chroma.random();
    const colors = [lastColor];
    let attempts = 0;
    while (colors.length < nColors && attempts < 10) {
      const possibleColor = chroma.random();
      if (chroma.deltaE(lastColor, possibleColor, 1, 1, 1) > this.deltaEThreshold) {
        colors.push(possibleColor);
        lastColor = possibleColor;
      }
      attempts += 1;
    }
    while (colors.length < nColors) {
      colors.push(chroma.random());
    }
    return this.newColors(colors);
  }
  /**
   * Adds the specified color.
   */
  push(color) {
    if (this.nColors >= this.maxNumberOfColors) {
      return this;
    }
    return this.newColors(this.colors.concat(chroma(color)));
  }
  /**
   * Adds a random color.
   */
  pushRandom() {
    return this.push(chroma.random());
  }
  /**
   * Drops the oldest color.
   */
  popOldest() {
    if (this.nColors < 2) {
      return this;
    }
    const oldestColor = this.hexes[0];
    return this.newColors(
      this.hexes.reduce((colors, hex) => {
        if (hex !== oldestColor) {
          colors.push(chroma(hex));
        }
        return colors;
      }, Array())
    );
  }
  /**
   * Drops the oldest color and pushes the new color.
   */
  rotateOn(color) {
    const newColors = [
      ...this.hexes.slice(1, this.hexes.length - 1),
      color
    ];
    return this.newColors(newColors);
  }
  /**
   * Drops the oldest color and adds a random color.
   */
  rotateRandomOn() {
    const lastColor = this.colors[this.colors.length - 1];
    let newColor;
    let attempts = 0;
    while (!newColor && attempts < 10) {
      const possibleColor = chroma.random();
      if (chroma.deltaE(lastColor, possibleColor, 1, 1, 1) > 20) {
        newColor = possibleColor;
      }
      attempts += 1;
    }
    return this.rotateOn(newColor ?? chroma.random());
  }
};

// src/mapRange.ts
function mapRange({
  fn = (x) => x,
  inRange = [0, 1],
  outRange
}) {
  const inWidth = inRange[1] - inRange[0];
  const outWidth = outRange[1] - outRange[0];
  return (value) => {
    const valueInOriginalRange = fn((value - inRange[0]) / inWidth);
    return outRange[0] + outWidth * valueInOriginalRange;
  };
}

// src/mapBrightnessToDarkenFactor.ts
var mapBrightnessToDarkenFactor = mapRange({
  inRange: [1, 255],
  outRange: [3, 0]
});

// src/safeMod.ts
function safeMod(n, modulus) {
  return (n % modulus + modulus) % modulus;
}

// src/Theme.ts
var Theme = class {
  constructor(config) {
    this.config = config;
    this._brightness = 255;
    this.transitionSpeed = 0;
    this.iColor = 0;
    this.colorDistanceThreshold = 1e-3;
    this.nSteps = this.config?.nSteps ?? 2048;
    this.mode = this.config?.mode ?? InterpolationModes.rgb;
    this.palette = new ColorPalette({
      colors: this.config?.colors ?? ["red", "green", "blue"],
      mode: this.mode,
      nSteps: this.nSteps,
      deltaEThreshold: this.config?.deltaEThreshold
    });
    this.colors = this.palette.scaleColors;
  }
  get scale() {
    return this.palette.scale;
  }
  /**
   * The active palette to use for color generation.
   */
  get activePalette() {
    return this.targetPalette ?? this.palette;
  }
  /**
   * The hex values of the colors in the active palette.
   */
  get activePaletteHexes() {
    const hexes = this.activePalette.hexes;
    hexes.pop();
    return hexes;
  }
  /**
   * The relative brightness of the theme.
   */
  get brightness() {
    return this._brightness;
  }
  /**
   * Set the relative brightness of the theme.
   */
  set brightness(brightness) {
    this._brightness = Math.max(1, Math.min(255, brightness));
  }
  getBaseColor(index = 0) {
    const baseColor = this.colors[this.normalizeIndex(index)];
    if (this._brightness === 255) {
      return baseColor;
    }
    return baseColor.darken(mapBrightnessToDarkenFactor(this._brightness));
  }
  /**
   * Get the color at the given index in the theme.
   * @param index The index of the color to get.
   * @param options Options for the color generation.
   * @param options.brightness Optionally adjust the brightness of the color. 0-255, defaults to 255.
   * @returns The color at the given index.
   */
  getColor(index = 0, { brightness = 255 } = {}) {
    const color = this.getBaseColor(index);
    if (brightness === 255) {
      return color;
    }
    return color.darken(mapBrightnessToDarkenFactor(brightness));
  }
  /**
   * Update the theme to a new set of colors.
   *
   * transitionSpeed should be between (0,1)
   */
  updateScale(targetPalette, { transitionSpeed = 0.1 } = {}) {
    if (targetPalette === this.palette) {
      this.clearTargetPalette();
      return;
    }
    if (targetPalette === this.targetPalette) {
      return;
    }
    this.mode = targetPalette.mode;
    this.transitionSpeed = Math.min(1, Math.max(0, transitionSpeed)) / 10;
    this.targetPalette = targetPalette;
    this.config?.onUpdate?.(this.targetPalette.hexes);
  }
  /**
   * Update the theme to a new set of colors, steps, and interpolation mode.
   */
  update({
    colors,
    nSteps,
    mode
  }, options) {
    this.updateScale(
      this.activePalette.newConfig({
        colors,
        nSteps,
        mode
      }),
      options
    );
  }
  /**
   * Set the interpolation mode of the theme.
   */
  setMode(mode = InterpolationModes.rgb, options) {
    this.updateScale(this.activePalette.newMode(mode), options);
  }
  /**
   * Rotate the interpolation mode of the theme.
   */
  rotateMode(options) {
    this.updateScale(this.activePalette.rotateMode(), options);
  }
  /**
   * Set the colors of the theme.
   */
  setColors(colorInputs, options) {
    this.updateScale(this.activePalette.newColors(colorInputs), options);
  }
  /**
   * Randomize the colors of the theme based on a seed color.
   */
  randomFrom(color, {
    minBrightness = 0,
    ...options
  }) {
    this.updateScale(
      this.activePalette.randomizeFrom(color, {
        minBrightness
      }),
      options
    );
  }
  /**
   * Randomize the colors of the theme.
   */
  randomTheme(options) {
    this.updateScale(this.activePalette.randomize(), options);
  }
  /**
   * Get the color at the given index in the theme.
   * Rounds and normalizes the index so that it is within the bounds of the color scale.
   */
  normalizeIndex(index = 0) {
    let normalizedIndex = Math.round(index);
    return safeMod(normalizedIndex + this.iColor, this.nSteps) % this.nSteps;
  }
  /**
   * Push a new color to the end of the palette.
   */
  pushNewColor(color, options) {
    this.updateScale(this.activePalette.push(color), options);
  }
  /**
   * Push a random color to the end of the palette.
   */
  pushRandomColor(options) {
    this.updateScale(this.activePalette.pushRandom(), options);
  }
  /**
   * Pop the oldest color from the palette.
   */
  popOldestColor(options) {
    this.updateScale(this.activePalette.popOldest(), options);
  }
  /**
   * Drops the oldest color and pushes the new color.
   */
  rotateColor(color, options) {
    this.updateScale(this.activePalette.rotateOn(color), options);
  }
  /**
   * Drops the oldest color and pushes a random color.
   */
  rotateRandomColor(options) {
    this.updateScale(this.activePalette.rotateRandomOn(), options);
  }
  clearTargetPalette() {
    this.targetPalette = void 0;
    this.previousColorDistance = void 0;
  }
  /**
   * Move the color index by n steps.
   * Can be negative to move backwards.
   */
  tick(n = 1) {
    if (this.targetPalette) {
      if (this.targetPalette === this.palette) {
        this.clearTargetPalette();
      } else {
        const targetColors = this.targetPalette.scaleColors;
        const colorDistances = targetColors.map(
          (color, iColor) => chroma2.deltaE(color, this.colors[iColor], 1, 1, 1)
        );
        const averageColorDistance = colorDistances.reduce((sum, d) => sum + d, 0) / colorDistances.length;
        if (this.previousColorDistance !== void 0 && Math.abs(
          this.previousColorDistance - averageColorDistance
        ) < this.colorDistanceThreshold) {
          this.palette = this.targetPalette;
          this.colors = this.palette.scaleColors;
          this.clearTargetPalette();
        } else {
          this.previousColorDistance = averageColorDistance;
          this.colors = this.colors.map(
            (baseColor, iColor) => chroma2(
              chroma2.mix(
                baseColor,
                targetColors[iColor],
                this.transitionSpeed,
                this.mode
              )
            )
          );
        }
      }
    }
    this.iColor += n;
  }
};
export {
  ColorPalette,
  InterpolationModes,
  Theme,
  getNextInterpolationMode,
  mapBrightnessToDarkenFactor
};
//# sourceMappingURL=index.mjs.map