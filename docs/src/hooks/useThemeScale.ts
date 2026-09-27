import { ThemeUpdateCallback, ThemeUpdateEvent } from '@colormotion';
import { useEffect, useState } from 'react';
import { useTheme } from '~/hooks/useTheme';

export function useThemeScale() {
    const theme = useTheme();
    const [palette, setPalette] = useState<
        Pick<ThemeUpdateEvent, 'palette' | 'colors'> | undefined
    >(undefined);

    useEffect(() => {
        const updatePalette: ThemeUpdateCallback = (event) => {
            setPalette({
                palette: event.palette,
                colors: event.colors,
            });
        };

        updatePalette(theme.subscribe(updatePalette));

        return () => {
            theme.unsubscribe(updatePalette);
        };
    }, [theme]);

    return palette;
}
