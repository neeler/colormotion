import clsx from 'clsx';
import p5 from 'p5';
import { ReactNode, useEffect, useRef } from 'react';
import { Sketch } from '~/components/sketches/Sketch';

export function BaseSketchWrapper({
    sketch: sketchDefinition,
    className,
    children,
}: {
    sketch: Sketch;
    className?: string;
    children?: ReactNode;
}) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) {
            return;
        }

        const sketch = new p5(sketchDefinition.get(wrapperRef), wrapper);

        return () => {
            sketch.remove?.();
        };
    }, [sketchDefinition]);

    return (
        <div
            ref={wrapperRef}
            className={clsx(className, 'bg-black max-w-full w-full')}
        >
            {children}
        </div>
    );
}
