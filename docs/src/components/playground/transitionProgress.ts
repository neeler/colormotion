import { ColorPalette, Theme, ThemeUpdateCallback } from '@colormotion';
import { getTheme, subscribeToThemeRebuilds } from '~/components/theme/theme';

export interface TransitionProgress {
    isTransitioning: boolean;
    /** From 0 to 1. */
    progress: number;
    /** theme.transitionDistance, to a tenth. */
    distance?: number;
}

const AT_REST: TransitionProgress = { isTransitioning: false, progress: 0 };

let state = AT_REST;
const listeners = new Set<() => void>();
let stopWatching: (() => void) | undefined;

function setState(next: TransitionProgress) {
    if (
        next.isTransitioning === state.isTransitioning &&
        next.progress === state.progress &&
        next.distance === state.distance
    ) {
        return;
    }
    state = next;
    listeners.forEach((listener) => listener());
}

/**
 * Measures a theme's transitions every animation frame while it has one:
 * progress is the fraction of the largest transitionDistance seen since the
 * target palette changed.
 */
function watch(theme: Theme) {
    let frame: number | undefined;
    let target: Readonly<ColorPalette> | undefined;
    let startDistance = 0;

    const measure = () => {
        const targetPalette = theme.targetPalette;
        if (!targetPalette) {
            frame = undefined;
            target = undefined;
            setState({ ...state, progress: 1, distance: undefined });
            return;
        }
        if (targetPalette !== target) {
            target = targetPalette;
            startDistance = 0;
        }
        const distance = theme.transitionDistance;
        if (distance !== undefined) {
            startDistance = Math.max(startDistance, distance);
        }
        setState({
            isTransitioning: state.isTransitioning,
            distance:
                distance === undefined
                    ? undefined
                    : Math.round(distance * 10) / 10,
            progress:
                distance === undefined || startDistance === 0
                    ? 0
                    : Math.round((1 - distance / startDistance) * 1000) / 1000,
        });
        frame = requestAnimationFrame(measure);
    };

    const onUpdate: ThemeUpdateCallback = (event) => {
        if (event.isTransitioning && frame === undefined) {
            setState({ isTransitioning: true, progress: 0 });
            frame = requestAnimationFrame(measure);
        } else {
            setState({ ...state, isTransitioning: event.isTransitioning });
        }
    };

    onUpdate(theme.subscribe(onUpdate));

    return () => {
        theme.unsubscribe(onUpdate);
        if (frame !== undefined) {
            cancelAnimationFrame(frame);
        }
    };
}

/**
 * The demo theme's transition progress, measured by one loop however many
 * components show it, and only while one does.
 */
export function subscribeToTransitionProgress(listener: () => void) {
    listeners.add(listener);
    if (!stopWatching) {
        let unwatch = watch(getTheme());
        const unsubscribeRebuilds = subscribeToThemeRebuilds(() => {
            unwatch();
            unwatch = watch(getTheme());
        });
        stopWatching = () => {
            unwatch();
            unsubscribeRebuilds();
        };
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size && stopWatching) {
            stopWatching();
            stopWatching = undefined;
            state = AT_REST;
        }
    };
}

export function getTransitionProgress() {
    return state;
}

export function getServerTransitionProgress() {
    return AT_REST;
}
