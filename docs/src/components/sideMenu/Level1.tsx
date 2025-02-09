import clsx from 'clsx';
import { ReactNode, useRef } from 'react';
import { useColorHex } from '~/hooks/useColorHex';

export function Level1({
    colorOffset = 0,
    children,
    className,
}: {
    colorOffset?: number;
    children: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLLIElement>(null);
    const color = useColorHex(colorOffset);
    return (
        <li
            ref={ref}
            className={clsx(
                'animate-fade-in text-lg font-bold text-black hover:underline',
                className,
            )}
            style={{
                color,
            }}
        >
            {children}
        </li>
    );
}
