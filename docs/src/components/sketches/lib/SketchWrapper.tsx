import clsx from 'clsx';
import { lazy, Suspense } from 'react';
import type {
    BaseSketchWrapperProps,
    BaseSketchWrapperType,
} from '~/components/sketches/lib/BaseSketchWrapper';

function BaseSketchWrapper<
    TState = unknown,
    TMovingState extends object = object,
>() {
    return lazy<BaseSketchWrapperType<TState, TMovingState>>(
        () => import('./BaseSketchWrapper'),
    );
}

export function SketchWrapper<
    TState = unknown,
    TMovingState extends object = object,
>({ className, sketch }: BaseSketchWrapperProps<TState, TMovingState>) {
    const Wrapper = BaseSketchWrapper<TState, TMovingState>();
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
