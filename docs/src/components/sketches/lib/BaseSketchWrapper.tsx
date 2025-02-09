import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { useP5 } from '~/hooks/useP5';
import { Sketch } from './Sketch';

export interface BaseSketchWrapperProps<TState, TMovingState extends object> {
    sketch: Sketch<TState, TMovingState>;
    className?: string;
}

export type BaseSketchWrapperType<
    TState = unknown,
    TMovingState extends object = object,
> = typeof BaseSketchWrapper<TState, TMovingState>;

export default function BaseSketchWrapper<
    TState = unknown,
    TMovingState extends object = object,
>({
    sketch: sketchDefinition,
    className,
}: BaseSketchWrapperProps<TState, TMovingState>) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const p5 = useP5();

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper || !p5) {
            return;
        }

        const sketch = new p5(sketchDefinition.get(wrapperRef), wrapper);

        return () => {
            sketch.remove?.();
        };
    }, [p5, sketchDefinition]);

    return (
        <div
            ref={wrapperRef}
            className={clsx(className, 'border-1 border-neutral-50 bg-black')}
        />
    );
}
