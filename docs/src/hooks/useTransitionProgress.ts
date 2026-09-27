import { useSyncExternalStore } from 'react';
import {
    getServerTransitionProgress,
    getTransitionProgress,
    subscribeToTransitionProgress,
} from '~/components/playground/transitionProgress';

/**
 * Whether the demo theme is transitioning, and how far along: measured every
 * animation frame from theme.transitionDistance, as the fraction of the
 * largest distance seen since the target palette changed.
 */
export function useTransitionProgress() {
    return useSyncExternalStore(
        subscribeToTransitionProgress,
        getTransitionProgress,
        getServerTransitionProgress,
    );
}
