import Link from 'next/link';
import { useRef } from 'react';
import { useColorHex } from '~/hooks/useColorHex';

export function L2MenuItem({
    colorOffset = 0,
    title,
    href,
}: {
    colorOffset?: number;
    title: string;
    href: string;
}) {
    const ref = useRef<HTMLLIElement>(null);
    const color = useColorHex(colorOffset);
    return (
        <li
            ref={ref}
            className="text-[15px] text-black transition-colors duration-500"
            style={{
                color,
            }}
        >
            <Link href={href}>{title}</Link>
        </li>
    );
}
