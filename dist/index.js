"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ColorPalette: () => ColorPalette,
  InterpolationModes: () => InterpolationModes,
  Theme: () => Theme,
  getNextInterpolationMode: () => getNextInterpolationMode,
  mapBrightnessToDarkenFactor: () => mapBrightnessToDarkenFactor
});
module.exports = __toCommonJS(index_exports);

// src/Theme.ts
var import_chroma_js2 = __toESM(require("chroma-js"));

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

// src/ColorPalette.ts
var import_chroma_js = __toESM(require("chroma-js"));
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
    this.colors = normalizedColors != null ? normalizedColors : _ColorPalette.normalizeColors(colors);
    this.nColors = this.colors.length - 1;
    this.hexes = this.colors.map((c) => c.hex());
    this.key = this.hexes.join(":");
    this.scale = import_chroma_js.default.scale(this.colors).mode(mode).domain([0, nSteps]).out(null);
    const scaleColors = this.scale.colors(nSteps + 1).map((c) => (0, import_chroma_js.default)(c));
    scaleColors.pop();
    this.scaleColors = scaleColors;
    this.deltaEThreshold = deltaEThreshold != null ? deltaEThreshold : 20;
  }
  static normalizeColors(colorInputs) {
    var _a, _b;
    const colors = colorInputs.map((value) => (0, import_chroma_js.default)(value));
    const firstColor = (_a = colors[0]) != null ? _a : (0, import_chroma_js.default)("green");
    colors[0] = firstColor;
    const firstHex = firstColor.hex();
    const lastHex = (_b = colors[colors.length - 1]) == null ? void 0 : _b.hex();
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
   */
  randomizeFrom(seed, {
    minBrightness = 0
  } = {}) {
    let lastColor = seed;
    const colors = [seed];
    let attempts = 0;
    while (colors.length < this.nColors && attempts < 10) {
      const possibleColor = import_chroma_js.default.random();
      if (import_chroma_js.default.deltaE(lastColor, possibleColor, 1, 1, 1) > this.deltaEThreshold && possibleColor.get("hsv.v") > minBrightness) {
        colors.push(possibleColor);
        lastColor = possibleColor;
      }
      attempts += 1;
    }
    while (colors.length < this.nColors) {
      colors.push(import_chroma_js.default.random());
    }
    return this.newColors(colors);
  }
  /**
   * Randomizes the whole palette with a random number of colors.
   */
  randomize(nColors = Math.floor(Math.random() * 3 + 3)) {
    let lastColor = import_chroma_js.default.random();
    const colors = [lastColor];
    let attempts = 0;
    while (colors.length < nColors && attempts < 10) {
      const possibleColor = import_chroma_js.default.random();
      if (import_chroma_js.default.deltaE(lastColor, possibleColor, 1, 1, 1) > this.deltaEThreshold) {
        colors.push(possibleColor);
        lastColor = possibleColor;
      }
      attempts += 1;
    }
    while (colors.length < nColors) {
      colors.push(import_chroma_js.default.random());
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
    return this.newColors(this.colors.concat((0, import_chroma_js.default)(color)));
  }
  /**
   * Adds a random color.
   */
  pushRandom() {
    return this.push(import_chroma_js.default.random());
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
          colors.push((0, import_chroma_js.default)(hex));
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
      const possibleColor = import_chroma_js.default.random();
      if (import_chroma_js.default.deltaE(lastColor, possibleColor, 1, 1, 1) > 20) {
        newColor = possibleColor;
      }
      attempts += 1;
    }
    return this.rotateOn(newColor != null ? newColor : import_chroma_js.default.random());
  }
};

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
    var _a, _b, _c, _d, _e, _f, _g;
    this.nSteps = (_b = (_a = this.config) == null ? void 0 : _a.nSteps) != null ? _b : 2048;
    this.mode = (_d = (_c = this.config) == null ? void 0 : _c.mode) != null ? _d : InterpolationModes.rgb;
    this.palette = new ColorPalette({
      colors: (_f = (_e = this.config) == null ? void 0 : _e.colors) != null ? _f : [],
      mode: this.mode,
      nSteps: this.nSteps,
      deltaEThreshold: (_g = this.config) == null ? void 0 : _g.deltaEThreshold
    });
    this.colors = this.palette.scaleColors;
  }
  get scale() {
    return this.palette.scale;
  }
  get activePalette() {
    var _a;
    return (_a = this.targetPalette) != null ? _a : this.palette;
  }
  get activePaletteHexes() {
    const hexes = this.activePalette.hexes;
    hexes.pop();
    return hexes;
  }
  get brightness() {
    return this._brightness;
  }
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
  getColor(index = 0, { brightness = 255 } = {}) {
    const color = this.getBaseColor(index);
    if (brightness === 255) {
      return color;
    }
    return color.darken(mapBrightnessToDarkenFactor(brightness));
  }
  /**
   * Transition Speed should be between (0,1)
   */
  updateScale(targetPalette, { transitionSpeed = 0.1 } = {}) {
    var _a, _b;
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
    (_b = (_a = this.config) == null ? void 0 : _a.onUpdate) == null ? void 0 : _b.call(_a, this.targetPalette.hexes);
  }
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
  setMode(mode = InterpolationModes.rgb, options) {
    this.updateScale(this.activePalette.newMode(mode), options);
  }
  rotateMode(options) {
    this.updateScale(this.activePalette.rotateMode(), options);
  }
  setColors(colorInputs, options) {
    this.updateScale(this.activePalette.newColors(colorInputs), options);
  }
  randomFrom(color, _a) {
    var _b = _a, {
      minBrightness = 0
    } = _b, options = __objRest(_b, [
      "minBrightness"
    ]);
    this.updateScale(
      this.activePalette.randomizeFrom(color, {
        minBrightness
      }),
      options
    );
  }
  randomTheme(options) {
    this.updateScale(this.activePalette.randomize(), options);
  }
  normalizeIndex(index = 0) {
    let normalizedIndex = Math.round(index);
    return safeMod(normalizedIndex + this.iColor, this.nSteps) % this.nSteps;
  }
  pushNewColor(color, options) {
    this.updateScale(this.activePalette.push(color), options);
  }
  pushRandomColor(options) {
    this.updateScale(this.activePalette.pushRandom(), options);
  }
  popOldestColor(options) {
    this.updateScale(this.activePalette.popOldest(), options);
  }
  rotateColor(color, options) {
    this.updateScale(this.activePalette.rotateOn(color), options);
  }
  rotateRandomColor(options) {
    this.updateScale(this.activePalette.rotateRandomOn(), options);
  }
  clearTargetPalette() {
    this.targetPalette = void 0;
    this.previousColorDistance = void 0;
  }
  tick(n = 1) {
    if (this.targetPalette) {
      if (this.targetPalette === this.palette) {
        this.clearTargetPalette();
      } else {
        const targetColors = this.targetPalette.scaleColors;
        const colorDistances = targetColors.map(
          (color, iColor) => import_chroma_js2.default.deltaE(color, this.colors[iColor], 1, 1, 1)
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
            (baseColor, iColor) => (0, import_chroma_js2.default)(
              import_chroma_js2.default.mix(
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

// src/index.ts
console.log("Test");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ColorPalette,
  InterpolationModes,
  Theme,
  getNextInterpolationMode,
  mapBrightnessToDarkenFactor
});
//# sourceMappingURL=index.js.map