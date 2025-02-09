import Link from 'next/link';
import { useRef } from 'react';
import { useSidebar } from '~/components/sideMenu/SidebarContext';
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
    const { setOpen } = useSidebar();
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
            <Link href={href} onClick={() => setOpen(false)}>
                {title}
            </Link>
        </li>
    );
}
