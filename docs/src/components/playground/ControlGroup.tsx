import clsx from 'clsx';
import { ReactNode, useState } from 'react';
import { ChevronRightIcon } from '~/components/icons/ChevronRightIcon';

/**
 * A collapsible group of playground controls. Its content mounts only while
 * it is open, so closed groups cost nothing while the theme changes.
 */
export function ControlGroup({
    title,
    summary,
    children,
    className,
}: {
    title: string;
    /** A short note of the group's current values, shown beside the title. */
    summary?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <details
            className={clsx(
                className,
                'group rounded-lg border border-white/10 bg-white/[2.5%]',
            )}
            onToggle={(event) => setOpen(event.currentTarget.open)}
        >
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3.5 py-2.5 text-base/6 select-none hover:bg-white/[2.5%] focus:outline-hidden focus-visible:outline-2 focus-visible:outline-blue-500 sm:px-3 sm:py-2 sm:text-sm/6 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" />
                <span className="shrink-0 font-medium text-white">{title}</span>
                {summary && (
                    <span className="ml-auto min-w-0 truncate text-zinc-500">
                        {summary}
                    </span>
                )}
            </summary>
            {open && (
                <div className="border-t border-white/10 p-3.5 sm:p-3">
                    {children}
                </div>
            )}
        </details>
    );
}
