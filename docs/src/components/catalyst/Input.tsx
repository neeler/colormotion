import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import { ForwardedRef, forwardRef } from 'react';

export const Input = forwardRef(function Input(
    {
        className,
        ...props
    }: { className?: string } & Omit<Headless.InputProps, 'as' | 'className'>,
    ref: ForwardedRef<HTMLInputElement>,
) {
    return (
        <span
            data-slot="control"
            className={clsx([
                className,
                // Basic layout
                'relative block w-full',
                // Focus ring
                'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
                // Disabled state
                'has-data-disabled:opacity-50',
            ])}
        >
            <Headless.Input
                ref={ref}
                {...props}
                className={clsx([
                    // Basic layout
                    'relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
                    // Typography
                    'text-base/6 text-white placeholder:text-zinc-500 sm:text-sm/6',
                    // Border
                    'border border-white/10 data-hover:border-white/20',
                    // Background color
                    'bg-white/5',
                    // Hide default focus styles
                    'focus:outline-hidden',
                    // Invalid state
                    'data-invalid:border-red-500 data-invalid:data-hover:border-red-500',
                    // Disabled state
                    'data-disabled:border-white/15 data-disabled:bg-white/[2.5%] data-hover:data-disabled:border-white/15',
                ])}
            />
        </span>
    );
});
