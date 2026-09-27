import clsx from 'clsx';
import { ComponentPropsWithoutRef, CSSProperties } from 'react';

/**
 * A range input styled to match the Catalyst controls.
 */
export function Slider({
    className,
    value,
    min = 0,
    max = 100,
    style,
    ...props
}: Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'min' | 'max'> & {
    value: number;
    min?: number;
    max?: number;
}) {
    const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return (
        <input
            {...props}
            type="range"
            value={value}
            min={min}
            max={max}
            className={clsx('range', className)}
            style={{ ...style, '--fill': `${fill}%` } as CSSProperties}
        />
    );
}
