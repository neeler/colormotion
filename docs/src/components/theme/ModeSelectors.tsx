import { InterpolationMode, InterpolationModes } from 'colormotion';
import { Select } from '~/components/catalyst/Select';
import { ModeButton } from '~/components/theme/ModeButton';
import { theme } from '~/components/theme/theme';
import { useInterpolationMode } from '~/hooks/useInterpolationMode';

const interpolationModes = Object.values(InterpolationModes);

export function ModeSelectors({ className }: { className?: string }) {
    const activeMode = useInterpolationMode();
    return (
        <div className={className}>
            <div className="hidden w-full space-x-2 lg:flex">
                {interpolationModes.map((mode) => (
                    <ModeButton
                        key={mode}
                        className="grow"
                        mode={mode}
                        activeMode={activeMode}
                    />
                ))}
            </div>
            <div className="block w-full lg:hidden">
                <Select
                    name="status"
                    className="w-full"
                    value={activeMode}
                    onChange={(event) => {
                        theme.setMode(
                            event.target.value.toLowerCase() as InterpolationMode,
                        );
                    }}
                >
                    {interpolationModes.map((mode) => (
                        <option key={mode} value={mode} className="uppercase">
                            {mode.toUpperCase()}
                        </option>
                    ))}
                </Select>
            </div>
        </div>
    );
}
