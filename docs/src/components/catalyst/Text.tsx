import clsx from 'clsx';
import { ComponentPropsWithoutRef } from 'react';
import { Link } from './Link';

export function Text({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
    return (
        <p
            data-slot="text"
            {...props}
            className={clsx(
                className,
                'text-base/6 text-neutral-400 sm:max-w-125',
            )}
        />
    );
}

export function TextLink({
    className,
    ...props
}: ComponentPropsWithoutRef<typeof Link>) {
    return (
        <Link
            {...props}
            className={clsx(
                className,
                'underline text-white decoration-white/50 data-hover:decoration-white',
            )}
        />
    );
}

export function Strong({
    className,
    ...props
}: ComponentPropsWithoutRef<'strong'>) {
    return (
        <strong
            {...props}
            className={clsx(className, 'font-medium text-white')}
        />
    );
}

export function Code({
    className,
    ...props
}: ComponentPropsWithoutRef<'code'>) {
    return (
        <code
            {...props}
            className={clsx(
                className,
                'rounded-sm border px-0.5 text-sm font-medium sm:text-[0.8125rem] border-white/20 bg-white/5 text-white',
            )}
        />
    );
}
