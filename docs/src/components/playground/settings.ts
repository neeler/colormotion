import { ColorUpdateConfig } from '@colormotion';
import { MAX_NUMBER_OF_COLORS } from '~/components/theme/theme';

/**
 * Frames a second the sketches aim for. The theme ticks once a frame, so a
 * transitionDuration of FRAME_RATE ticks is about a second.
 */
export const FRAME_RATE = 60;

export const TransitionKinds = {
    speed: 'speed',
    duration: 'duration',
} as const;

export type TransitionKind =
    (typeof TransitionKinds)[keyof typeof TransitionKinds];

export const SketchViews = {
    spiral: 'spiral',
    strip: 'strip',
} as const;

export type SketchView = (typeof SketchViews)[keyof typeof SketchViews];

/**
 * transitionSpeed stops for the speed slider: 1-2-5 steps from 0.001 to 1.
 */
export const TRANSITION_SPEEDS = [
    0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1,
];

/**
 * The index of the TRANSITION_SPEEDS stop nearest a speed (on a log scale,
 * as the stops are).
 */
export function transitionSpeedIndex(speed: number) {
    const distance = (stop: number) =>
        Math.abs(Math.log(stop) - Math.log(Math.max(speed, 1e-9)));
    return TRANSITION_SPEEDS.reduce(
        (nearest, stop, i) =>
            distance(stop) < distance(TRANSITION_SPEEDS[nearest]!)
                ? i
                : nearest,
        0,
    );
}

export interface Range {
    min: number;
    max: number;
    step: number;
}

/**
 * The ranges of the playground's number controls, for their sliders and for
 * reading a shared link.
 */
export const RANGES = {
    transitionSeconds: { min: 0, max: 30, step: 0.5 },
    nColors: { min: 1, max: MAX_NUMBER_OF_COLORS, step: 1 },
    minBrightness: { min: 0, max: 1, step: 0.05 },
    wheelSpeed: { min: -20, max: 20, step: 0.5 },
    pixelSpacing: { min: 0, max: 64, step: 1 },
    brightness: { min: 0, max: 1, step: 0.01 },
    deltaEThreshold: { min: 0, max: 50, step: 1 },
} satisfies Record<string, Range>;

/**
 * A number in a range, on one of its steps.
 */
export function toRange(n: number, { min, max, step }: Range) {
    const stepped = min + Math.round((n - min) / step) * step;
    // toFixed drops float noise such as 0.6000000000000001
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(6));
}

/**
 * How far the wheel speed drifts from the chosen speed, as factors of it.
 */
export const WHEEL_DRIFT = { min: 0.2, max: 1.8 };

/**
 * Playground settings that live outside the theme: how updates transition,
 * what the random actions ask for, and how the sketches turn the wheel.
 */
export interface PlaygroundSettings {
    transitionKind: TransitionKind;
    /** transitionSpeed for updates when transitionKind is 'speed'. */
    transitionSpeed: number;
    /** transitionDuration, in seconds at FRAME_RATE, when transitionKind is 'duration'. */
    transitionSeconds: number;
    /** nColors for randomTheme. */
    nColors: number;
    /** minBrightness for the random actions. */
    minBrightness: number;
    /** n for theme.tick(n), once a frame. */
    wheelSpeed: number;
    /** Lets the wheel speed wander within WHEEL_DRIFT of wheelSpeed. */
    wheelDrift: boolean;
    /** Ticks with n = 0: the wheel holds and transitions still advance. */
    paused: boolean;
    view: SketchView;
    /** Wheel steps between neighboring LEDs in the strip view. */
    pixelSpacing: number;
}

export const DEFAULT_SETTINGS: PlaygroundSettings = {
    transitionKind: TransitionKinds.speed,
    transitionSpeed: 0.1,
    transitionSeconds: 6,
    nColors: 5,
    minBrightness: 0.6,
    wheelSpeed: 5,
    wheelDrift: true,
    paused: false,
    view: SketchViews.spiral,
    pixelSpacing: 16,
};

let settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

export function getSettings() {
    return settings;
}

export function updateSettings(changes: Partial<PlaygroundSettings>) {
    settings = { ...settings, ...changes };
    listeners.forEach((listener) => listener());
}

export function subscribeToSettings(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * The transitionSpeed or transitionDuration for a theme update.
 */
export function transitionOptions({
    transitionKind,
    transitionSpeed,
    transitionSeconds,
}: PlaygroundSettings = settings): ColorUpdateConfig {
    return transitionKind === TransitionKinds.duration
        ? { transitionDuration: transitionSeconds * FRAME_RATE }
        : { transitionSpeed };
}
