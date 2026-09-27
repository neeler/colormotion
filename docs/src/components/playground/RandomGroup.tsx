import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/catalyst/Button';
import { Input } from '~/components/catalyst/Input';
import { Code } from '~/components/catalyst/Text';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { Slider } from '~/components/playground/Slider';
import {
    getSettings,
    RANGES,
    transitionOptions,
    updateSettings,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { getTheme, rebuildTheme } from '~/components/theme/theme';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useThemeOptions } from '~/hooks/useThemeOptions';
import { randomSeed } from '~/lib/seededRandom';

export function RandomGroup() {
    const { nColors, minBrightness } = usePlaygroundSettings();
    const { seed } = useThemeOptions();
    return (
        <ControlGroup
            title="Randomness"
            summary={`${nColors} colors · min ${formatNumber(minBrightness)}${seed ? ` · seed ${seed}` : ''}`}
        >
            <RandomControls />
        </ControlGroup>
    );
}

function RandomControls() {
    const { nColors, minBrightness } = usePlaygroundSettings();
    return (
        <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2">
            <Field
                label="Random colors"
                value={nColors}
                description={
                    <>
                        <Code>nColors</Code> for Random theme.
                    </>
                }
            >
                {(id) => (
                    <Slider
                        id={id}
                        {...RANGES.nColors}
                        value={nColors}
                        aria-valuetext={`${nColors} ${nColors === 1 ? 'color' : 'colors'}`}
                        onChange={(event) =>
                            updateSettings({
                                nColors: Number(event.target.value),
                            })
                        }
                    />
                )}
            </Field>
            <Field
                label="Min brightness"
                value={formatNumber(minBrightness)}
                description={
                    <>
                        <Code>minBrightness</Code>: the lowest HSV value a
                        random color can have.
                    </>
                }
            >
                {(id) => (
                    <Slider
                        id={id}
                        {...RANGES.minBrightness}
                        value={minBrightness}
                        aria-valuetext={formatNumber(minBrightness)}
                        onChange={(event) =>
                            updateSettings({
                                minBrightness: Number(event.target.value),
                            })
                        }
                    />
                )}
            </Field>
            <DeltaEField />
            <SeedField />
        </div>
    );
}

/**
 * deltaEThreshold is read when the theme is built, so a change rebuilds it:
 * once the slider rests, rather than on every step of a drag, and at once if
 * the group closes first.
 */
function DeltaEField() {
    const { deltaEThreshold } = useThemeOptions();
    const [draft, setDraft] = useState<number | undefined>(undefined);
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const pending = useRef<number | undefined>(undefined);
    const value = draft ?? deltaEThreshold;

    useEffect(
        () => () => {
            clearTimeout(timeout.current);
            if (pending.current !== undefined) {
                rebuildTheme({ deltaEThreshold: pending.current });
                pending.current = undefined;
            }
        },
        [],
    );

    return (
        <Field
            label="Min difference"
            value={`${formatNumber(value)} ΔE`}
            description={
                <>
                    <Code>deltaEThreshold</Code>: how far each random color is
                    from the one before (CIEDE2000).
                </>
            }
        >
            {(id) => (
                <Slider
                    id={id}
                    {...RANGES.deltaEThreshold}
                    value={value}
                    aria-valuetext={`${formatNumber(value)} delta E`}
                    onChange={(event) => {
                        const next = Number(event.target.value);
                        setDraft(next);
                        pending.current = next;
                        clearTimeout(timeout.current);
                        timeout.current = setTimeout(() => {
                            pending.current = undefined;
                            rebuildTheme({ deltaEThreshold: next });
                            setDraft(undefined);
                        }, 200);
                    }}
                />
            )}
        </Field>
    );
}

/**
 * Applying a seed (a new one, or the same one again) rebuilds the theme with
 * a generator seeded from it, and starts its sequence with a random theme, so
 * the same seed replays the same palettes.
 */
function SeedField() {
    const { seed } = useThemeOptions();
    const [draft, setDraft] = useState<string | undefined>(undefined);
    const text = draft ?? seed;

    const applySeed = (next: string) => {
        setDraft(undefined);
        rebuildTheme({ seed: next, restartRandom: true });
        if (next) {
            const settings = getSettings();
            getTheme().randomTheme({
                nColors: settings.nColors,
                minBrightness: settings.minBrightness,
                ...transitionOptions(settings),
            });
        }
    };

    return (
        <Field
            label="Seed"
            description={
                <>
                    Seeds the theme&apos;s <Code>random</Code> option: the same
                    seed replays the same palettes. Empty for Math.random.
                </>
            }
        >
            {(id) => (
                <div className="flex gap-2">
                    <Input
                        id={id}
                        value={text}
                        placeholder="Math.random"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                applySeed(text.trim());
                            }
                        }}
                        className="min-w-0 flex-1"
                    />
                    <Button color="zinc" onClick={() => applySeed(text.trim())}>
                        {text.trim() && text.trim() === seed
                            ? 'Replay'
                            : 'Apply'}
                    </Button>
                    <Button
                        color="dark"
                        title="A new random seed"
                        onClick={() => applySeed(randomSeed())}
                    >
                        New
                    </Button>
                </div>
            )}
        </Field>
    );
}
