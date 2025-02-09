import { ThemeUpdateCallback } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';
import { safeMod } from '~/lib/safeMod';

export function useColorHex(index = 0) {
    const [color, setColor] = useState<string | undefined>(undefined);

    useEffect(() => {
        const updateColor: ThemeUpdateCallback = (event) => {
            const colors = event.colors;
            const color = colors[safeMod(index, colors.length)];
            setColor(color.hex('rgb'));
        };

        updateColor(theme.subscribe(updateColor));

        return () => {
            theme.unsubscribe(updateColor);
        };
    }, []);

    return color;
}
