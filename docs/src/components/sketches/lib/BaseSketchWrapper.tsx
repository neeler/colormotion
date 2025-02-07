import clsx from 'clsx';
import { ReactNode, useEffect, useRef } from 'react';
import { useP5 } from '~/hooks/useP5';
import { Sketch } from './Sketch';

export interface BaseSketchWrapperProps {
    sketch: Sketch;
    className?: string;
    children?: ReactNode;
}

export default function BaseSketchWrapper({
    sketch: sketchDefinition,
    className,
    children,
}: BaseSketchWrapperProps) {
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
        >
            {children}
        </div>
    );
}
