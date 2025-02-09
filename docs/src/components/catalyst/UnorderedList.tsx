import { ReactNode } from 'react';

export function UnorderedList({ children }: { children: ReactNode }) {
    return (
        <ul className="list-disc pl-6 text-base/6 text-neutral-400">
            {children}
        </ul>
    );
}
