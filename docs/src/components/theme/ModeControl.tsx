import { InterpolationModes } from '@colormotion';
import clsx from 'clsx';
import { Button } from '~/components/catalyst/Button';
import { RotateIcon } from '~/components/icons/RotateIcon';
import { Segmented } from '~/components/playground/Segmented';
import { transitionOptions } from '~/components/playground/settings';
import { getTheme } from '~/components/theme/theme';
import { useInterpolationMode } from '~/hooks/useInterpolationMode';

const interpolationModes = Object.values(InterpolationModes);

/**
 * The interpolation modes as a segmented control, in even rows (two of five,
 * or one of ten when there is room), and a button to rotate to the next.
 */
export function ModeControl({ className }: { className?: string }) {
    const activeMode = useInterpolationMode();
    return (
        <div className={clsx(className, 'space-y-1.5')}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-base/6 font-medium text-white sm:text-sm/6">
                    Interpolation mode
                </span>
                <Button
                    color="dark"
                    aria-label="Next interpolation mode"
                    title="theme.rotateMode()"
                    className="-my-1"
                    onClick={() => {
                        getTheme().rotateMode(transitionOptions());
                    }}
                >
                    <RotateIcon />
                    Next
                </Button>
            </div>
            <Segmented
                label="Interpolation mode"
                value={activeMode}
                onChange={(mode) => {
                    getTheme().setMode(mode, transitionOptions());
                }}
                options={interpolationModes.map((mode) => ({
                    value: mode,
                    label: mode.toUpperCase(),
                    title: `theme.setMode('${mode}')`,
                }))}
                className="grid-cols-5 @2xl:grid-cols-10"
            />
        </div>
    );
}
