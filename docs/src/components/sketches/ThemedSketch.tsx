import clsx from 'clsx';
import { Sketch } from '~/components/sketches/lib/Sketch';
import { SketchWrapper } from '~/components/sketches/lib/SketchWrapper';
import { AddRandomColorButton } from '~/components/theme/AddRandomColorButton';
import { CurrentPalette } from '~/components/theme/CurrentPalette';
import { CurrentThemeScale } from '~/components/theme/CurrentThemeScale';
import { ModeSelectors } from '~/components/theme/ModeSelectors';
import { PopOldestColorButton } from '~/components/theme/PopOldestColorButton';
import { RandomThemeButton } from '~/components/theme/RandomThemeButton';
import { RotateModeButton } from '~/components/theme/RotateModeButton';
import { RotateRandomColorButton } from '~/components/theme/RotateRandomColorButton';

const minBrightness = 150;

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
                    <PopOldestColorButton className="grow" />
                </div>
            </div>
            <div className="flex space-x-4">
                <RotateModeButton className="grow lg:grow-0" />
                <ModeSelectors className="grow" />
            </div>
        </div>
    );
}
