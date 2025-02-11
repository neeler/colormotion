import { ThemeUpdateCallback, ThemeUpdateEvent } from '@colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function useInterpolationMode() {
    const [mode, setMode] = useState<ThemeUpdateEvent['mode'] | undefined>(
        undefined,
    );

    useEffect(() => {
        const updatePalette: ThemeUpdateCallback = (event) => {
            setMode(event.mode);
        };

        updatePalette(theme.subscribe(updatePalette));

        return () => {
            theme.unsubscribe(updatePalette);
        };
    }, []);

    return mode;
}
