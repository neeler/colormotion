import { ThemeUpdateCallback, ThemeUpdateEvent } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function useThemeScale() {
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
    }, []);

    return palette;
}
