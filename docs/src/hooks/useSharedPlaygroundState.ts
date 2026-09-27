import { useEffect } from 'react';
import {
    applySharedState,
    clearSharedHash,
} from '~/components/playground/share';

/**
 * Restores a playground state shared in the location hash, on load and when
 * a shared link is opened on the page. The hash is dropped once it is
 * applied, so going Back from a section link, or reloading, doesn't bring it
 * back over what has changed since.
 */
export function useSharedPlaygroundState() {
    useEffect(() => {
        const restore = () => {
            if (applySharedState(window.location.hash)) {
                clearSharedHash();
            }
        };
        restore();
        window.addEventListener('hashchange', restore);
        return () => {
            window.removeEventListener('hashchange', restore);
        };
    }, []);
}
