import Link from 'next/link';
import { Level1 } from '~/components/sideMenu/Level1';

export function SideMenu({ className }: { className?: string }) {
    return (
        <div className={className}>
            <ul className="space-y-5">
                <Level1 colorOffset={0}>
                    <Link href="#installation">Installation</Link>
                </Level1>
                <Level1 colorOffset={100}>
                    <Link href="#quick-start">Quick Start</Link>
                </Level1>
                <Level1 colorOffset={200}>
                    <Link href="#interpolation">Interpolation</Link>
                </Level1>
            </ul>
        </div>
    );
}
