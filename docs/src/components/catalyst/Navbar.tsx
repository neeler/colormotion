'use client';

import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import {
    ComponentPropsWithoutRef,
    ForwardedRef,
    forwardRef,
    ReactNode,
} from 'react';
import { TouchTarget } from './Button';
import { Link } from './Link';

export const NavbarItem = forwardRef(function NavbarItem(
    {
        current,
        className,
        children,
        ...props
    }: { current?: boolean; className?: string; children: ReactNode } & (
        | Omit<Headless.ButtonProps, 'as' | 'className'>
        | Omit<ComponentPropsWithoutRef<typeof Link>, 'className'>
    ),
    ref: ForwardedRef<HTMLAnchorElement | HTMLButtonElement>,
) {
    const classes = clsx(
        // Base
        'relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium sm:text-sm/5',
        // Leading icon/icon-only
        '*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-5',
        // Trailing icon (down chevron or similar)
        '*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4',
        // Avatar
        '*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 *:data-[slot=avatar]:[--avatar-radius:var(--radius)] *:data-[slot=avatar]:[--ring-opacity:10%] sm:*:data-[slot=avatar]:size-6',
        // Dark mode
        'text-white *:data-[slot=icon]:fill-zinc-400',
        'data-hover:bg-white/5 data-hover:*:data-[slot=icon]:fill-white',
        'data-active:bg-white/5 data-active:*:data-[slot=icon]:fill-white',
    );

    return (
        <span className={clsx(className, 'relative')}>
            {'href' in props ? (
                <Link
                    {...props}
                    className={classes}
                    data-current={current ? 'true' : undefined}
                    ref={ref as ForwardedRef<HTMLAnchorElement>}
                >
                    <TouchTarget>{children}</TouchTarget>
                </Link>
            ) : (
                <Headless.Button
                    {...props}
                    className={clsx('cursor-default', classes)}
                    data-current={current ? 'true' : undefined}
                    ref={ref}
                >
                    <TouchTarget>{children}</TouchTarget>
                </Headless.Button>
            )}
        </span>
    );
});
