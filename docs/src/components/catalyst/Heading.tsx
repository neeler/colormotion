import clsx from 'clsx';
import { ComponentPropsWithoutRef } from 'react';
import { Link } from '~/components/catalyst/Link';

type HeadingProps = {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    id?: string;
} & ComponentPropsWithoutRef<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;

export function Heading({ className, level = 1, id, ...props }: HeadingProps) {
    let Element: `h${typeof level}` = `h${level}`;

    if (!id) {
        return (
            <Element
                {...props}
                className={clsx(
                    className,
                    'pt-8 text-2xl/8 font-semibold text-white',
                )}
            />
        );
    }

    return (
        <Link
            href={`#${id}`}
            className={clsx('relative inline-block pt-8', className)}
        >
            <Element
                {...props}
                id={id}
                className={clsx('inline text-2xl/8 font-semibold text-white', {
                    "before:absolute before:-left-5 before:text-neutral-400 hover:before:content-['#']":
                        id,
                })}
            />
        </Link>
    );
}

export function Subheading({ className, level = 2, ...props }: HeadingProps) {
    let Element: `h${typeof level}` = `h${level}`;

    return (
        <Element
            {...props}
            className={clsx(
                className,
                'text-base/7 font-semibold text-white sm:text-sm/6',
            )}
        />
    );
}
