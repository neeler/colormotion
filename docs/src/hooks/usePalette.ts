import { ColorPalette, ThemeUpdateCallback } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function usePalette() {
    const [palette, setPalette] = useState<ColorPalette | undefined>(undefined);

    useEffect(() => {
        setPalette(theme.palette);

        const updatePalette: ThemeUpdateCallback = (event) => {
            setPalette(event.palette);
            console.log(event.palette.colors.map((c) => c.hex()));
        };

        theme.subscribe(updatePalette);

        return () => {
            theme.unsubscribe(updatePalette);
        };
    }, []);

    return palette;
}
