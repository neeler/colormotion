import { useSyncExternalStore } from 'react';
import {
    getSettings,
    subscribeToSettings,
} from '~/components/playground/settings';

/**
 * The playground's settings, re-rendering when they change.
 */
export function usePlaygroundSettings() {
    return useSyncExternalStore(subscribeToSettings, getSettings, getSettings);
}
