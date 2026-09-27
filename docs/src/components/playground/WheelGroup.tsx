import { BrightnessModes } from '@colormotion';
import { Code } from '~/components/catalyst/Text';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { Segmented } from '~/components/playground/Segmented';
import { Slider } from '~/components/playground/Slider';
import { SwitchField } from '~/components/playground/SwitchField';
import {
    RANGES,
    updateSettings,
    WHEEL_DRIFT,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { rebuildTheme } from '~/components/theme/theme';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useTheme } from '~/hooks/useTheme';
import { useThemeOptions } from '~/hooks/useThemeOptions';
import { useThemeStatus } from '~/hooks/useThemeStatus';

export function WheelGroup() {
    const { wheelSpeed, wheelDrift, paused } = usePlaygroundSettings();
    const { brightnessMode } = useThemeOptions();
    const brightness = useThemeStatus()?.brightness ?? 1;
    // brightness and its mode only once changed, so the summary fits a phone
    const light = [
        brightness !== 1 && `${Math.round(brightness * 100)}%`,
        brightnessMode === BrightnessModes.linear && 'linear',
    ].filter(Boolean);
    return (
        <ControlGroup
            title="Wheel and brightness"
            summary={
                <>
                    {paused ? 'paused' : `${formatNumber(wheelSpeed)}/tick`}
                    {!paused && wheelDrift && (
                        <span className="hidden @xs:inline"> · drift</span>
                    )}
                    {light.map((part) => ` · ${part}`).join('')}
                </>
            }
        >
            <WheelControls />
        </ControlGroup>
    );
}

function WheelControls() {
    const { wheelSpeed, wheelDrift, paused, pixelSpacing } =
        usePlaygroundSettings();
    const { brightnessMode } = useThemeOptions();
    const theme = useTheme();
    const brightness = useThemeStatus()?.brightness ?? 1;

    return (
        <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2">
            <Field
                label="Wheel speed"
                value={`${formatNumber(wheelSpeed)} steps a tick`}
                description={
                    <>
                        The n in <Code>theme.tick(n)</Code>, once a frame, of{' '}
                        {theme.nSteps} steps around; below 0 turns it back.
                    </>
                }
            >
                {(id) => (
                    <Slider
                        id={id}
                        {...RANGES.wheelSpeed}
                        value={wheelSpeed}
                        aria-valuetext={`${formatNumber(wheelSpeed)} steps a tick`}
                        onChange={(event) =>
                            updateSettings({
                                wheelSpeed: Number(event.target.value),
                            })
                        }
                    />
                )}
            </Field>
            <div className="space-y-3">
                <SwitchField
                    label="Drift"
                    description={`Lets the speed wander between ${WHEEL_DRIFT.min}× and ${WHEEL_DRIFT.max}× of it.`}
                    checked={wheelDrift}
                    onChange={(checked) =>
                        updateSettings({ wheelDrift: checked })
                    }
                />
                <SwitchField
                    label="Pause"
                    description={
                        <>
                            <Code>theme.tick(0)</Code>: the wheel holds,
                            transitions still advance.
                        </>
                    }
                    checked={paused}
                    onChange={(checked) => updateSettings({ paused: checked })}
                />
            </div>
            <Field
                label="Brightness"
                value={`${Math.round(brightness * 100)}%`}
                description={
                    <>
                        <Code>theme.brightness</Code>, applied to every color{' '}
                        <Code>getColor</Code> returns.
                    </>
                }
            >
                {(id) => (
                    <Slider
                        id={id}
                        {...RANGES.brightness}
                        value={brightness}
                        aria-valuetext={`${Math.round(brightness * 100)}%`}
                        onChange={(event) => {
                            theme.brightness = Number(event.target.value);
                        }}
                    />
                )}
            </Field>
            <Field
                label="Brightness mode"
                description={
                    brightnessMode === BrightnessModes.linear ? (
                        <>
                            Scales the channels: 0 is black, the LEDs off. Set
                            at construction, so this rebuilds the theme.
                        </>
                    ) : (
                        <>
                            Darkens in CIELAB: light colors keep a glow at 0.
                            Set at construction, so this rebuilds the theme.
                        </>
                    )
                }
            >
                <Segmented
                    label="Brightness mode"
                    value={brightnessMode}
                    onChange={(next) => rebuildTheme({ brightnessMode: next })}
                    options={Object.values(BrightnessModes).map((mode) => ({
                        value: mode,
                        label: `'${mode}'`,
                    }))}
                    className="grid-cols-2"
                />
            </Field>
            <Field
                label="LED spacing"
                value={`getColor(i * ${pixelSpacing})`}
                description="Wheel steps between neighboring LEDs in the LED strip sketch."
                className="@xl:col-span-2"
            >
                {(id) => (
                    <Slider
                        id={id}
                        {...RANGES.pixelSpacing}
                        value={pixelSpacing}
                        aria-valuetext={`${pixelSpacing} steps`}
                        onChange={(event) =>
                            updateSettings({
                                pixelSpacing: Number(event.target.value),
                            })
                        }
                    />
                )}
            </Field>
        </div>
    );
}
