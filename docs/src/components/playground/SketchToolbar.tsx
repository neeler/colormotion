import clsx from 'clsx';
import { PauseIcon } from '~/components/icons/PauseIcon';
import { PlayIcon } from '~/components/icons/PlayIcon';
import { Segmented } from '~/components/playground/Segmented';
import { SketchViews, updateSettings } from '~/components/playground/settings';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';

/**
 * Chooses the sketch and pauses the wheel, over the sketch.
 */
export function SketchToolbar({ className }: { className?: string }) {
    const { view, paused } = usePlaygroundSettings();
    return (
        <div
            className={clsx(
                className,
                'flex items-center gap-1 rounded-lg bg-black/70 p-1 ring-1 ring-white/15 backdrop-blur-sm',
            )}
        >
            <Segmented
                bare
                label="Sketch"
                value={view}
                onChange={(next) => updateSettings({ view: next })}
                options={[
                    { value: SketchViews.spiral, label: 'Spiral' },
                    { value: SketchViews.strip, label: 'LED strip' },
                ]}
                className="grid-cols-2"
            />
            <span className="h-5 w-px bg-white/15" />
            <button
                type="button"
                aria-label="Pause the wheel"
                aria-pressed={paused}
                title={paused ? 'Turn the wheel' : 'Pause the wheel: tick(0)'}
                onClick={() => updateSettings({ paused: !paused })}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-zinc-300 hover:bg-white/5 hover:text-white focus:outline-hidden focus-visible:outline-2 focus-visible:outline-blue-500"
            >
                {paused ? (
                    <PlayIcon className="size-4" />
                ) : (
                    <PauseIcon className="size-4" />
                )}
            </button>
        </div>
    );
}
