import { ThemeUpdateCallback } from '@colormotion';
import { useEffect, useState } from 'react';
import { useTheme } from '~/hooks/useTheme';

export function useNColors() {
    const theme = useTheme();
    const [nColors, setNColors] = useState<number | undefined>(undefined);

    useEffect(() => {
        const updateNColors: ThemeUpdateCallback = (event) => {
            setNColors(event.palette.nColors);
        };

        updateNColors(theme.subscribe(updateNColors));

        return () => {
            theme.unsubscribe(updateNColors);
        };
    }, [theme]);

    return nColors;
}
