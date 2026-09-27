import { useSyncExternalStore } from 'react';
import {
    getThemeSnapshot,
    subscribeToThemeRebuilds,
} from '~/components/theme/theme';

/**
 * The demo theme. Components re-render with the new theme when it is
 * rebuilt, so effects that depend on it subscribe to the new one.
 */
export function useTheme() {
    return useSyncExternalStore(
        subscribeToThemeRebuilds,
        getThemeSnapshot,
        getThemeSnapshot,
    ).theme;
}
