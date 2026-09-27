import clsx from 'clsx';
import { useMemo } from 'react';
import { useThemeScale } from '~/hooks/useThemeScale';

/**
 * Colors sampled from the scale for the gradient: plenty for a smooth strip,
 * far fewer elements than one per step.
 */
const N_STOPS = 128;

/**
 * The active palette's whole scale, around the wheel and back to its first
 * color.
 */
export function CurrentThemeScale({ className }: { className?: string }) {
    const colors = useThemeScale()?.colors;

    const background = useMemo(() => {
        if (!colors?.length) {
            return undefined;
        }
        const stops = Array.from({ length: N_STOPS + 1 }, (_, i) =>
            colors[
                Math.floor((i * colors.length) / N_STOPS) % colors.length
            ]!.hex('rgb'),
        );
        return `linear-gradient(to right, ${stops.join(', ')})`;
    }, [colors]);

    return (
        <div
            className={clsx(className, 'h-9 w-full rounded-lg bg-white/5')}
            style={{ background }}
        />
    );
}
