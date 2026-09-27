import clsx from 'clsx';
import { lazy, Suspense } from 'react';
import type {
    BaseSketchWrapperProps,
    BaseSketchWrapperType,
} from '~/components/sketches/lib/BaseSketchWrapper';

/**
 * Made once, so re-rendering a SketchWrapper keeps its sketch running instead
 * of mounting a new lazy component (and a new p5 instance) on every render.
 */
const LazyBaseSketchWrapper = lazy(() => import('./BaseSketchWrapper'));

export function SketchWrapper<
    TState = unknown,
    TMovingState extends object = object,
>({ className, sketch }: BaseSketchWrapperProps<TState, TMovingState>) {
    const Wrapper = LazyBaseSketchWrapper as unknown as BaseSketchWrapperType<
        TState,
        TMovingState
    >;
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
            <Wrapper sketch={sketch} className={className} />
        </Suspense>
    );
}
