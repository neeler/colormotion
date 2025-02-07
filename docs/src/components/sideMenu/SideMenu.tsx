import clsx from 'clsx';
import Link from 'next/link';
import { Level1 } from '~/components/sideMenu/Level1';

export function SideMenu({ className }: { className?: string }) {
    return (
        <div className={clsx('pt-28 pr-7.5 pl-10', className)}>
            <ul className="space-y-5">
                <Level1>
                    <Link href="#installation">Installation</Link>
                </Level1>
                <Level1>
                    <Link href="#quick-start">Quick Start</Link>
                </Level1>
                <Level1>
                    <Link href="#interpolation">Interpolation</Link>
                </Level1>
            </ul>
        </div>
    );
}
