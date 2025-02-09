import Link from 'next/link';
import { ReactNode, useRef } from 'react';
import { useColorHex } from '~/hooks/useColorHex';

export function L1MenuItem({
    colorOffset = 0,
    title,
    href,
    children,
}: {
    colorOffset?: number;
    title: string;
    href: string;
    children?: ReactNode;
}) {
    const ref = useRef<HTMLLIElement>(null);
    const color = useColorHex(colorOffset);
    return (
        <li
            ref={ref}
            className="text-[17px] font-bold text-black transition-colors duration-500"
            style={{
                color,
            }}
        >
            <Link href={href} className="block">
                {title}
            </Link>
            {children && (
                <ul className="mt-2.5 list-disc space-y-2.5 pl-6 font-normal">
                    {children}
                </ul>
            )}
        </li>
    );
}
