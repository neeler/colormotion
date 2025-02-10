import clsx from 'clsx';
import { Sketch } from '~/components/sketches/lib/Sketch';
import { SketchWrapper } from '~/components/sketches/lib/SketchWrapper';
import { AddRandomColorButton } from '~/components/theme/AddRandomColorButton';
import { CurrentPalette } from '~/components/theme/CurrentPalette';
import { CurrentThemeScale } from '~/components/theme/CurrentThemeScale';
import { DropOldestColorButton } from '~/components/theme/DropOldestColorButton';
import { ModeSelectors } from '~/components/theme/ModeSelectors';
import { RandomThemeButton } from '~/components/theme/RandomThemeButton';
import { RotateModeButton } from '~/components/theme/RotateModeButton';
import { RotateRandomColorButton } from '~/components/theme/RotateRandomColorButton';

const minBrightness = 0.6;

export function ThemedSketch<
    TState = unknown,
    TMovingState extends object = object,
>({
    sketch,
    className,
}: {
    sketch: Sketch<TState, TMovingState>;
    className?: string;
}) {
    return (
        <div className={clsx('space-y-4', className)}>
            <SketchWrapper sketch={sketch} className="h-100 w-full" />
            <CurrentPalette className="max-lg:hidden" />
            <CurrentThemeScale />
            <div className="space-y-4 sm:flex sm:space-y-0 sm:space-x-4">
                <div className="flex space-x-4 sm:grow">
                    <RandomThemeButton
                        minBrightness={minBrightness}
                        className="grow"
                    />
                    <RotateRandomColorButton
                        minBrightness={minBrightness}
                        className="grow"
                    />
                </div>
                <div className="flex space-x-4 sm:grow">
                    <AddRandomColorButton
                        minBrightness={minBrightness}
                        className="grow"
                    />
                    <DropOldestColorButton className="grow" />
                </div>
            </div>
            <div className="flex space-x-4">
                <RotateModeButton className="grow lg:grow-0" />
                <ModeSelectors className="grow" />
            </div>
        </div>
    );
}
