import { BrightnessModes, chroma, InterpolationModes } from '@colormotion';
import {
    DEFAULT_SETTINGS,
    getSettings,
    PlaygroundSettings,
    RandomSpaces,
    randomOptions,
    Range,
    RANGES,
    SketchViews,
    toRange,
    TRANSITION_SPEEDS,
    transitionSpeedIndex,
    TransitionKinds,
    updateSettings,
} from '~/components/playground/settings';
import {
    DEFAULT_THEME_OPTIONS,
    getTheme,
    getThemeSnapshot,
    rebuildTheme,
} from '~/components/theme/theme';

/**
 * The start of a location hash that holds a playground state.
 */
const HASH_PREFIX = '#playground?';

/**
 * The most seeded random draws a link can skip ahead: thousands of random
 * themes, and a few milliseconds to replay.
 */
const MAX_DRAWS = 1_000_000;

type Parser<T> = (value: string | null) => T | undefined;

const toNumber = (value: string | null) => {
    const n = Number(value);
    return value && Number.isFinite(n) ? n : undefined;
};

/**
 * A number in a control's range, on one of its steps, as the control could
 * have set it.
 */
const inRange =
    (range: Range): Parser<number> =>
    (value) => {
        const n = toNumber(value);
        return n === undefined ? undefined : toRange(n, range);
    };

const boolean: Parser<boolean> = (value) =>
    value === '1' ? true : value === '0' ? false : undefined;

const oneOf =
    <T extends string>(values: Record<string, T>): Parser<T> =>
    (value) =>
        Object.values(values).find((known) => known === value);

const settingsParsers: {
    [K in keyof PlaygroundSettings]: Parser<PlaygroundSettings[K]>;
} = {
    transitionKind: oneOf(TransitionKinds),
    transitionSpeed: (value) => {
        const n = toNumber(value);
        return n === undefined
            ? undefined
            : TRANSITION_SPEEDS[transitionSpeedIndex(n)];
    },
    transitionSeconds: inRange(RANGES.transitionSeconds),
    nColors: inRange(RANGES.nColors),
    minBrightness: inRange(RANGES.minBrightness),
    randomSpace: oneOf(RandomSpaces),
    hueCenter: inRange(RANGES.hueCenter),
    hueWidth: inRange(RANGES.hueWidth),
    chromaMin: inRange(RANGES.chroma),
    chromaMax: inRange(RANGES.chroma),
    avoidOliveAndLime: boolean,
    wheelSpeed: inRange(RANGES.wheelSpeed),
    wheelDrift: boolean,
    paused: boolean,
    view: oneOf(SketchViews),
    pixelSpacing: inRange(RANGES.pixelSpacing),
};

/**
 * A number without float noise: at most three decimals.
 */
export function formatNumber(n: number) {
    return String(Math.round(n * 1000) / 1000);
}

/**
 * A link to the playground as it is now: the palette it is at or heading
 * to, the mode, and every option and setting that differs from its default.
 */
export function shareUrl() {
    const { theme, options, generator } = getThemeSnapshot();
    const settings = getSettings();

    const entries: [string, string][] = [
        [
            'colors',
            theme.activePaletteHexes.map((hex) => hex.slice(1)).join(','),
        ],
        ['mode', theme.mode],
    ];
    if (theme.brightness !== 1) {
        entries.push(['brightness', formatNumber(theme.brightness)]);
    }
    if (options.brightnessMode !== DEFAULT_THEME_OPTIONS.brightnessMode) {
        entries.push(['brightnessMode', options.brightnessMode]);
    }
    if (options.deltaEThreshold !== DEFAULT_THEME_OPTIONS.deltaEThreshold) {
        entries.push([
            'deltaEThreshold',
            formatNumber(options.deltaEThreshold),
        ]);
    }
    if (options.seed) {
        entries.push(['seed', options.seed]);
    }
    const draws = generator?.draws ?? 0;
    if (draws > 0 && draws <= MAX_DRAWS) {
        // how far into the seed's sequence, so the next random palette is the same
        entries.push(['draws', String(draws)]);
    }
    for (const key of Object.keys(
        settingsParsers,
    ) as (keyof PlaygroundSettings)[]) {
        const value = settings[key];
        if (value !== DEFAULT_SETTINGS[key]) {
            entries.push([
                key,
                typeof value === 'boolean'
                    ? value
                        ? '1'
                        : '0'
                    : typeof value === 'number'
                      ? formatNumber(value)
                      : value,
            ]);
        }
    }

    const query = entries
        .map(
            ([key, value]) =>
                `${key}=${encodeURIComponent(value).replace(/%2C/gi, ',')}`,
        )
        .join('&');
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}${search}${HASH_PREFIX}${query}`;
}

/**
 * Restores the playground from a location hash made by shareUrl, if it is
 * one; anything it leaves out takes its default. Returns whether it was one.
 */
export function applySharedState(hash: string) {
    if (!hash.startsWith(HASH_PREFIX)) {
        return false;
    }
    const params = new URLSearchParams(hash.slice(HASH_PREFIX.length));

    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const [key, parse] of Object.entries(settingsParsers)) {
        const value = parse(params.get(key));
        if (value !== undefined) {
            settings[key] = value;
        }
    }
    updateSettings(settings as unknown as PlaygroundSettings);
    const { nColors } = getSettings();

    const colors = (params.get('colors') ?? '')
        .split(',')
        .map((color) => color.trim())
        .filter(Boolean)
        .map((color) => (/^[0-9a-f]{3,8}$/i.test(color) ? `#${color}` : color))
        .filter((color) => chroma.valid(color));
    const seed = params.get('seed') ?? '';

    rebuildTheme({
        colors: colors.length ? colors : undefined,
        mode: oneOf(InterpolationModes)(params.get('mode')),
        seed,
        restartRandom: true,
        brightnessMode:
            oneOf(BrightnessModes)(params.get('brightnessMode')) ??
            DEFAULT_THEME_OPTIONS.brightnessMode,
        deltaEThreshold:
            inRange(RANGES.deltaEThreshold)(params.get('deltaEThreshold')) ??
            DEFAULT_THEME_OPTIONS.deltaEThreshold,
    });

    const { theme, generator } = getThemeSnapshot();
    if (!colors.length && seed) {
        // the seed's first palette, so the link alone reproduces it
        theme.randomTheme({
            nColors,
            ...randomOptions(),
            transitionDuration: 0,
        });
    }
    if (generator) {
        // carry on where the sharer's sequence was
        const draws = inRange({ min: 0, max: MAX_DRAWS, step: 1 })(
            params.get('draws'),
        );
        while (draws !== undefined && generator.draws < draws) {
            generator.random();
        }
    }
    theme.brightness =
        inRange(RANGES.brightness)(params.get('brightness')) ?? 1;
    return true;
}

/**
 * Drops a shared state from the address bar and from this history entry, so
 * that neither Back nor a reload brings it back over later changes.
 */
export function clearSharedHash() {
    if (window.location.hash.startsWith(HASH_PREFIX)) {
        const { pathname, search } = window.location;
        window.history.replaceState(null, '', `${pathname}${search}`);
    }
}

/**
 * Puts every setting and theme option back to its default, with a new random
 * palette, and drops a shared state from the address bar.
 */
export function resetPlayground() {
    updateSettings(DEFAULT_SETTINGS);
    rebuildTheme({
        ...DEFAULT_THEME_OPTIONS,
        mode: InterpolationModes.rgb,
    });
    const theme = getTheme();
    theme.brightness = 1;
    theme.randomTheme({
        nColors: DEFAULT_SETTINGS.nColors,
        ...randomOptions(DEFAULT_SETTINGS),
    });
    clearSharedHash();
}
