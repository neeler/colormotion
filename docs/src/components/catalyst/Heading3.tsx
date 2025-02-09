import clsx from 'clsx';
import { ComponentPropsWithoutRef } from 'react';
import { Link } from '~/components/catalyst/Link';

export function Heading3({
    className,
    id,
    ...props
}: ComponentPropsWithoutRef<'h2'>) {
    const fontClass = 'text-lg/8 font-semibold text-white';

    if (!id) {
        return <h3 {...props} className={clsx(className, fontClass, 'pt-8')} />;
    }

    return (
        <Link
            href={`#${id}`}
            className={clsx('relative inline-block pt-8', className)}
        >
            <h3
                {...props}
                id={id}
                className={clsx(fontClass, 'inline', {
                    "before:absolute before:-left-5 before:text-neutral-400 hover:before:content-['#']":
                        id,
                })}
            />
        </Link>
    );
}
