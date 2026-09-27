import {
    BrightnessMode,
    BrightnessModes,
    ColorInput,
    DEFAULT_DELTA_E_THRESHOLD,
    InterpolationMode,
    Theme,
    ThemeUpdateEvent,
} from '@colormotion';
import { seededRandom } from '~/lib/seededRandom';

/**
 * Max number of colors in the demo theme's palettes.
 */
export const MAX_NUMBER_OF_COLORS = 7;

/**
 * The options the demo theme is constructed with. They are readonly on a
 * Theme (random is only read at construction), so changing one rebuilds it.
 */
export interface ThemeOptions {
    /**
     * Seeds the theme's random option, for reproducible random palettes.
     * Empty for Math.random.
     */
    seed: string;
    brightnessMode: BrightnessMode;
    deltaEThreshold: number;
}

export const DEFAULT_THEME_OPTIONS: ThemeOptions = {
    seed: '',
    brightnessMode: BrightnessModes.darken,
    deltaEThreshold: DEFAULT_DELTA_E_THRESHOLD,
};

/**
 * Logs theme update events to the console for visibility.
 * Could be helpful for folks reading the docs.
 */
const eventsToConsole = (event: ThemeUpdateEvent) => {
    console.log('Theme has updated:', event);
};

/**
 * The theme's seeded random, counting its draws so a link can say how far
 * into the seed's sequence the playground is.
 */
export interface SeededGenerator {
    seed: string;
    draws: number;
    random: () => number;
}

function seededGenerator(seed: string): SeededGenerator {
    const next = seededRandom(seed);
    const generator: SeededGenerator = {
        seed,
        draws: 0,
        random: () => {
            generator.draws += 1;
            return next();
        },
    };
    return generator;
}

let snapshot: {
    theme: Theme;
    options: ThemeOptions;
    /** The seeded random the theme uses, if it has a seed. */
    generator?: SeededGenerator;
} = {
    theme: new Theme({
        maxNumberOfColors: MAX_NUMBER_OF_COLORS,
        nColors: 5,
        minBrightness: 0.6,
    }),
    options: DEFAULT_THEME_OPTIONS,
};
snapshot.theme.subscribe(eventsToConsole);

const listeners = new Set<() => void>();

/**
 * The demo theme. Rebuilding it replaces it, so read it where it is used
 * (the sketches read it every frame) or through the useTheme hook, which
 * re-renders on a rebuild so subscriptions move to the new theme.
 */
export function getTheme() {
    return snapshot.theme;
}

/**
 * The demo theme, the options it was built with and its seeded random; a new
 * object after every rebuild.
 */
export function getThemeSnapshot() {
    return snapshot;
}

/**
 * Calls the listener whenever the theme is rebuilt.
 */
export function subscribeToThemeRebuilds(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Replaces the demo theme with one built with the given options, keeping the
 * rest: the colors it is at or heading to (unless given), its mode (unless
 * given), its brightness and where its wheel is.
 * A seeded random carries on where it was, so a rebuild for another option
 * doesn't replay palettes; a new seed, or restartRandom, starts the seed's
 * sequence from the beginning.
 */
export function rebuildTheme({
    colors,
    mode,
    restartRandom = false,
    ...changes
}: Partial<ThemeOptions> & {
    colors?: ColorInput[];
    mode?: InterpolationMode;
    restartRandom?: boolean;
} = {}) {
    const previous = snapshot.theme;
    const options = { ...snapshot.options, ...changes };
    const generator = !options.seed
        ? undefined
        : !restartRandom && snapshot.generator?.seed === options.seed
          ? snapshot.generator
          : seededGenerator(options.seed);
    const theme = new Theme({
        colors: colors ?? previous.activePaletteHexes,
        mode: mode ?? previous.mode,
        maxNumberOfColors: MAX_NUMBER_OF_COLORS,
        deltaEThreshold: options.deltaEThreshold,
        brightnessMode: options.brightnessMode,
        random: generator?.random,
    });
    theme.brightness = previous.brightness;
    // normalizeIndex(0) is the wheel position
    theme.tick(previous.normalizeIndex(0));

    previous.unsubscribe(eventsToConsole);
    theme.subscribe(eventsToConsole);
    snapshot = { theme, options, generator };
    listeners.forEach((listener) => listener());
}
