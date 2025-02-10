import Link from 'next/link';
import { ReactNode, useRef } from 'react';
import { useSidebar } from '~/components/sideMenu/SidebarContext';
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
    const { setOpen } = useSidebar();
    const ref = useRef<HTMLLIElement>(null);
    const color = useColorHex(colorOffset);
    return (
        <li ref={ref}>
            <Link
                href={href}
                onClick={() => setOpen(false)}
                className="block text-[17px] font-bold text-black transition-colors duration-500 hover:!text-white"
                style={{
                    color,
                }}
            >
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
