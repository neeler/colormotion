import * as Headless from '@headlessui/react';
import clsx from 'clsx';

export function Switch({
    className,
    ...props
}: { className?: string } & Omit<Headless.SwitchProps, 'as' | 'className'>) {
    return (
        <Headless.Switch
            data-slot="control"
            {...props}
            className={clsx(
                className,
                // Base layout
                'group relative isolate inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full p-[3px] sm:h-5 sm:w-8',
                // Transitions
                'transition duration-0 ease-in-out data-changing:duration-200',
                // Unchecked
                'bg-white/5 ring-1 ring-white/15 ring-inset',
                // Checked
                'data-checked:bg-zinc-200 data-checked:ring-transparent',
                // Focus
                'focus:outline-hidden data-focus:outline data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500',
                // Hover
                'data-hover:ring-white/25 data-checked:data-hover:ring-transparent',
                // Disabled
                'data-disabled:cursor-default data-disabled:opacity-50',
            )}
        >
            <span
                aria-hidden="true"
                className={clsx(
                    // Basic layout
                    'pointer-events-none relative inline-block size-4.5 rounded-full sm:size-3.5',
                    // Transition
                    'translate-x-0 transition duration-200 ease-in-out',
                    // Unchecked
                    'bg-zinc-400 shadow-sm',
                    // Checked
                    'group-data-checked:translate-x-4 group-data-checked:bg-zinc-950 sm:group-data-checked:translate-x-3',
                )}
            />
        </Headless.Switch>
    );
}
