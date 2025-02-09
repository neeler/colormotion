import clsx from 'clsx';
import { ReactNode } from 'react';

export function Heading1({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <h1
            className={clsx(
                'my-8 text-5xl font-thin tracking-tight',
                className,
            )}
        >
            {children}
        </h1>
    );
}
