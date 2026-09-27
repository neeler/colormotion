import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import { ReactNode } from 'react';

/**
 * A row (or grid) of mutually exclusive options, one of which is on.
 * Set the columns with a grid-cols class.
 */
export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    bare,
    className,
}: {
    /** Accessible name of the group. */
    label: string;
    value?: T;
    options: { value: T; label: ReactNode; title?: string }[];
    onChange: (value: T) => void;
    /** Without its own border and background, as inside a toolbar. */
    bare?: boolean;
    className?: string;
}) {
    return (
        <Headless.RadioGroup
            aria-label={label}
            value={value ?? null}
            onChange={(next: T | null) => {
                if (next !== null) onChange(next);
            }}
            className={clsx(
                className,
                'grid gap-1',
                !bare && 'rounded-lg border border-white/10 bg-white/5 p-1',
            )}
        >
            {options.map((option) => (
                <Headless.Radio
                    key={option.value}
                    value={option.value}
                    title={option.title}
                    className={clsx(
                        // Base
                        'relative flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-0.5 py-1.5 font-semibold whitespace-nowrap text-zinc-400 transition-colors select-none',
                        // Text: sm, or a little smaller in the narrowest containers
                        // (whatever the text size), so five modes such as OKLCH fit a row
                        'text-[length:min(var(--text-sm),4.5cqi)] leading-5',
                        // Hover
                        'data-hover:bg-white/5 data-hover:text-white',
                        // Checked
                        'data-checked:bg-white/15 data-checked:text-white data-checked:shadow-[inset_0_1px_--theme(--color-white/10%)]',
                        // Focus
                        'focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-1 data-focus:outline-blue-500',
                    )}
                >
                    <span className="min-w-0 truncate">{option.label}</span>
                </Headless.Radio>
            ))}
        </Headless.RadioGroup>
    );
}
