import { ColorPalette, ThemeUpdateCallback } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function usePalette() {
    const [palette, setPalette] = useState<ColorPalette | undefined>(undefined);

    useEffect(() => {
        const updatePalette: ThemeUpdateCallback = (event) => {
            setPalette(event.palette);
        };

        updatePalette(theme.subscribe(updatePalette));

        return () => {
            theme.unsubscribe(updatePalette);
        };
    }, []);

    return palette;
}
