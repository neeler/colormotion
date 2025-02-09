import clsx from 'clsx';
import { lazy, Suspense } from 'react';
import { BaseSketchWrapperProps } from '~/components/sketches/lib/BaseSketchWrapper';

const BaseSketchWrapper = lazy(() => import('./BaseSketchWrapper'));

export function SketchWrapper({ className, ...props }: BaseSketchWrapperProps) {
    return (
        <Suspense
            fallback={
                <div
                    className={clsx(
                        'border-1 border-neutral-50 bg-black',
                        className,
                    )}
                />
            }
        >
            <BaseSketchWrapper {...props} className={className} />
        </Suspense>
    );
}
