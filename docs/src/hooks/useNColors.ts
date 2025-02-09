import { ThemeUpdateCallback } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function useNColors() {
    const [nColors, setNColors] = useState<number | undefined>(undefined);

    useEffect(() => {
        const updateNColors: ThemeUpdateCallback = (event) => {
            setNColors(event.palette.nColors);
        };

        updateNColors(theme.subscribe(updateNColors));

        return () => {
            theme.unsubscribe(updateNColors);
        };
    }, []);

    return nColors;
}
