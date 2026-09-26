import { ThemeUpdateCallback, ThemeUpdateEvent } from '@colormotion';
import { useEffect, useState } from 'react';
import { useTheme } from '~/hooks/useTheme';

export function useInterpolationMode() {
    const theme = useTheme();
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
    }, [theme]);

    return mode;
}
