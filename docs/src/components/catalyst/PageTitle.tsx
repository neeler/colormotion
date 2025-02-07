import clsx from 'clsx';
import { ReactNode } from 'react';

export function PageTitle({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <h1
            className={clsx(
                'text-5xl font-thin tracking-tight my-8',
                className,
            )}
        >
            {children}
        </h1>
    );
}
