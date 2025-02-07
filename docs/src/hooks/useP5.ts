import type p5Type from 'p5';
import { useEffect, useState } from 'react';

export function useP5() {
    const [p5, setP5] = useState<typeof p5Type | null>(null);

    useEffect(() => {
        import('p5').then((module) => {
            setP5(() => module.default);
        });
    }, []);

    return p5;
}
