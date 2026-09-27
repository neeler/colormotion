import { ThemeUpdateCallback, ThemeUpdateEvent } from '@colormotion';
import { useEffect, useState } from 'react';
import { useTheme } from '~/hooks/useTheme';

/**
 * The demo theme's latest update event: its active palette, mode, brightness
 * and whether it is transitioning.
 */
export function useThemeStatus() {
    const theme = useTheme();
    const [status, setStatus] = useState<ThemeUpdateEvent | undefined>(
        undefined,
    );

    useEffect(() => {
        const updateStatus: ThemeUpdateCallback = (event) => {
            setStatus(event);
        };

        updateStatus(theme.subscribe(updateStatus));

        return () => {
            theme.unsubscribe(updateStatus);
        };
    }, [theme]);

    return status;
}
