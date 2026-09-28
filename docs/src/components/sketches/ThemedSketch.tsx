import clsx from 'clsx';
import { CodeGroup } from '~/components/playground/CodeGroup';
import { PaletteGroup } from '~/components/playground/PaletteGroup';
import { RandomGroup } from '~/components/playground/RandomGroup';
import { ShapeGroup } from '~/components/playground/ShapeGroup';
import { SketchToolbar } from '~/components/playground/SketchToolbar';
import { TransitionBar } from '~/components/playground/TransitionBar';
import { TransitionGroup } from '~/components/playground/TransitionGroup';
import { WheelGroup } from '~/components/playground/WheelGroup';
import { SketchViews } from '~/components/playground/settings';
import { fibonacciSpiralSketch } from '~/components/sketches/fibonacciSpiralSketch';
import { ledStripSketch } from '~/components/sketches/ledStripSketch';
import { SketchWrapper } from '~/components/sketches/lib/SketchWrapper';
import { CurrentThemeScale } from '~/components/theme/CurrentThemeScale';
import { ModeControl } from '~/components/theme/ModeControl';
import { PaletteEditor } from '~/components/theme/PaletteEditor';
import { ThemeActions } from '~/components/theme/ThemeActions';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useSharedPlaygroundState } from '~/hooks/useSharedPlaygroundState';

/**
 * The demo theme in a sketch, with controls for experimenting with it: the
 * palette, its scale, updates, the interpolation mode, and collapsible groups
 * for transitions, randomness, the palette's shape, the wheel and brightness,
 * and code.
 */
export function ThemedSketch({ className }: { className?: string }) {
    useSharedPlaygroundState();
    return (
        <div className={clsx('@container space-y-4', className)}>
            <div className="relative">
                <PlaygroundSketch />
                <SketchToolbar className="absolute right-3 bottom-3" />
                <TransitionBar className="absolute inset-x-px bottom-px" />
            </div>
            <PaletteEditor />
            <CurrentThemeScale />
            <ThemeActions />
            <ModeControl />
            <div className="space-y-2">
                <PaletteGroup />
                <TransitionGroup />
                <RandomGroup />
                <ShapeGroup />
                <WheelGroup />
                <CodeGroup />
            </div>
        </div>
    );
}

function PlaygroundSketch() {
    const { view } = usePlaygroundSettings();
    return view === SketchViews.strip ? (
        <SketchWrapper sketch={ledStripSketch} className="h-100 w-full" />
    ) : (
        <SketchWrapper
            sketch={fibonacciSpiralSketch}
            className="h-100 w-full"
        />
    );
}
