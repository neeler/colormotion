import { useSyncExternalStore } from 'react';
import {
    getThemeSnapshot,
    subscribeToThemeRebuilds,
} from '~/components/theme/theme';

/**
 * The options the demo theme was built with (seed, brightnessMode,
 * deltaEThreshold).
 */
export function useThemeOptions() {
    return useSyncExternalStore(
        subscribeToThemeRebuilds,
        getThemeSnapshot,
        getThemeSnapshot,
    ).options;
}
