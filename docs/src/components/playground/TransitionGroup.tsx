import clsx from 'clsx';
import { Button } from '~/components/catalyst/Button';
import { Code } from '~/components/catalyst/Text';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { Segmented } from '~/components/playground/Segmented';
import { Slider } from '~/components/playground/Slider';
import {
    FRAME_RATE,
    RANGES,
    TRANSITION_SPEEDS,
    transitionSpeedIndex,
    TransitionKinds,
    updateSettings,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { getTheme } from '~/components/theme/theme';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useTransitionProgress } from '~/hooks/useTransitionProgress';

/**
 * Roughly how long a typical palette change takes at a transitionSpeed:
 * about 45 / speed ticks.
 */
function aboutSeconds(speed: number) {
    const seconds = 45 / speed / FRAME_RATE;
    return seconds < 60
        ? `${Math.max(1, Math.round(seconds))} s`
        : `${Math.round(seconds / 60)} min`;
}

export function TransitionGroup() {
    const { transitionKind, transitionSpeed, transitionSeconds } =
        usePlaygroundSettings();
    return (
        <ControlGroup
            title="Transition"
            summary={
                transitionKind === TransitionKinds.duration
                    ? `${formatNumber(transitionSeconds)} s`
                    : `speed ${formatNumber(transitionSpeed)}`
            }
        >
            <TransitionControls />
        </ControlGroup>
    );
}

function TransitionControls() {
    const { transitionKind, transitionSpeed, transitionSeconds } =
        usePlaygroundSettings();

    return (
        <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2">
            <Field
                label="Transition by"
                description="Every palette and mode change on this page uses it."
            >
                <Segmented
                    label="Transition by"
                    value={transitionKind}
                    onChange={(next) =>
                        updateSettings({ transitionKind: next })
                    }
                    options={[
                        { value: TransitionKinds.speed, label: 'Speed' },
                        {
                            value: TransitionKinds.duration,
                            label: 'Duration',
                        },
                    ]}
                    className="grid-cols-2"
                />
            </Field>
            {transitionKind === TransitionKinds.speed ? (
                <Field
                    label="Speed"
                    value={`${formatNumber(transitionSpeed)} · about ${aboutSeconds(transitionSpeed)}`}
                    description={
                        <>
                            <Code>transitionSpeed</Code>: each tick moves part
                            of the way, so changes slow as they arrive.
                        </>
                    }
                >
                    {(id) => (
                        <Slider
                            id={id}
                            min={0}
                            max={TRANSITION_SPEEDS.length - 1}
                            step={1}
                            value={transitionSpeedIndex(transitionSpeed)}
                            aria-valuetext={`${formatNumber(transitionSpeed)}, about ${aboutSeconds(transitionSpeed)}`}
                            onChange={(event) =>
                                updateSettings({
                                    transitionSpeed:
                                        TRANSITION_SPEEDS[
                                            Number(event.target.value)
                                        ],
                                })
                            }
                        />
                    )}
                </Field>
            ) : (
                <Field
                    label="Duration"
                    value={`${formatNumber(transitionSeconds)} s · ${Math.round(transitionSeconds * FRAME_RATE)} ticks`}
                    description={
                        <>
                            <Code>transitionDuration</Code> in ticks, easing in
                            and out; 0 is instant.
                        </>
                    }
                >
                    {(id) => (
                        <Slider
                            id={id}
                            {...RANGES.transitionSeconds}
                            value={transitionSeconds}
                            aria-valuetext={`${formatNumber(transitionSeconds)} seconds`}
                            onChange={(event) =>
                                updateSettings({
                                    transitionSeconds: Number(
                                        event.target.value,
                                    ),
                                })
                            }
                        />
                    )}
                </Field>
            )}
            <Progress className="@xl:col-span-2" />
        </div>
    );
}

/**
 * How far the current transition is, apart from the fields so that only it
 * re-renders every frame.
 */
function Progress({ className }: { className?: string }) {
    const { isTransitioning, progress, distance } = useTransitionProgress();
    return (
        <div className={clsx(className, 'space-y-2')}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm/6 text-zinc-400 tabular-nums">
                    {isTransitioning ? (
                        <>
                            <span className="text-white">
                                {Math.round(progress * 100)}%
                            </span>
                            {distance !== undefined &&
                                ` · ${distance.toFixed(1)} ΔE to go`}
                        </>
                    ) : (
                        'At rest'
                    )}
                </p>
                <Button
                    color="dark"
                    disabled={!isTransitioning}
                    title="theme.finishTransition()"
                    onClick={() => getTheme().finishTransition()}
                >
                    Finish now
                </Button>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-zinc-200"
                    style={{
                        width: `${(isTransitioning ? progress : 0) * 100}%`,
                    }}
                />
            </div>
        </div>
    );
}
