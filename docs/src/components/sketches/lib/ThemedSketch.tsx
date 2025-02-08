import clsx from 'clsx';
import { Sketch } from '~/components/sketches/lib/Sketch';
import { SketchWrapper } from '~/components/sketches/lib/SketchWrapper';
import { RandomThemeButton } from '~/components/theme/RandomThemeButton';

export function ThemedSketch({
    sketch,
    className,
}: {
    sketch: Sketch;
    className?: string;
}) {
    return (
        <div className={clsx('space-y-4', className)}>
            <SketchWrapper sketch={sketch} className="h-100 w-full" />
            <div className="flex space-x-4">
                <RandomThemeButton />
            </div>
        </div>
    );
}
