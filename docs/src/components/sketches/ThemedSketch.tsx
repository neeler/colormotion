import clsx from 'clsx';
import { Button } from '~/components/catalyst/Button';
import { Sketch } from '~/components/sketches/lib/Sketch';
import { SketchWrapper } from '~/components/sketches/lib/SketchWrapper';
import { CurrentPalette } from '~/components/theme/CurrentPalette';
import { CurrentThemeScale } from '~/components/theme/CurrentThemeScale';
import { theme } from '~/components/theme/theme';

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
            <CurrentPalette />
            <CurrentThemeScale />
            <div className="flex space-x-4">
                <Button
                    className="grow"
                    color="zinc"
                    onClick={() => {
                        theme.randomTheme();
                    }}
                >
                    Full Random Theme
                </Button>
                <Button
                    className="grow"
                    color="zinc"
                    onClick={() => {
                        theme.rotateRandomColor();
                    }}
                >
                    Rotate In Random Color
                </Button>
            </div>
        </div>
    );
}
