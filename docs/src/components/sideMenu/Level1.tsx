import clsx from 'clsx';
import { ReactNode, useRef } from 'react';
import { theme } from '~/theme';

export function Level1({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLLIElement>(null);
    return (
        <li
            ref={ref}
            className={clsx('text-lg font-bold text-neutral-100', className)}
            onMouseOver={(event) => {
                const element = ref.current;
                if (element) {
                    element.style.color = theme.getColor().hex();
                }
            }}
            onMouseLeave={(event) => {
                const element = ref.current;
                if (element) {
                    element.style.color = '';
                }
            }}
        >
            {children}
        </li>
    );
}
