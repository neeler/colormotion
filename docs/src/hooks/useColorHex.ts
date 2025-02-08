import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function useColorHex(index = 0) {
    const [color, setColor] = useState<string | undefined>(undefined);

    useEffect(() => {
        const updateColor = () => {
            setColor(theme.getColor(index).hex('rgb'));
        };
        updateColor();

        theme.subscribe(updateColor);

        return () => {
            theme.unsubscribe(updateColor);
        };
    }, []);

    return color;
}
