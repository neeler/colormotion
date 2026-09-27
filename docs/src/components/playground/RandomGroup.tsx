import { colorFromHue, randomColor } from '@colormotion';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '~/components/catalyst/Button';
import { Input } from '~/components/catalyst/Input';
import { Code } from '~/components/catalyst/Text';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { Segmented } from '~/components/playground/Segmented';
import { Slider } from '~/components/playground/Slider';
import { SwitchField } from '~/components/playground/SwitchField';
import {
    getSettings,
    PlaygroundSettings,
    randomConstraint,
    randomOptions,
    RandomSpaces,
    RANGES,
    transitionOptions,
    updateSettings,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { getTheme, rebuildTheme } from '~/components/theme/theme';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useThemeOptions } from '~/hooks/useThemeOptions';
import { randomSeed, seededRandom } from '~/lib/seededRandom';

export function RandomGroup() {
    const { nColors, minBrightness, randomSpace } = usePlaygroundSettings();
    const { seed } = useThemeOptions();
    return (
        <ControlGroup
            title="Randomness"
            summary={`${nColors} colors · min ${formatNumber(minBrightness)}${randomSpace === RandomSpaces.oklch ? ' · OKLCH' : ''}${seed ? ` · seed ${seed}` : ''}`}
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
            <ConstraintControls />
        </div>
    );
}

/** The hues around the wheel, as a slider track: OKLCH hue 0° to 360°. */
const HUE_TRACK = `linear-gradient(to right, ${Array.from(
    { length: 13 },
    (_, i) => colorFromHue({ hue: i * 30, brightness: 1, chroma: 0.8 }).hex(),
).join(', ')})`;

/** A hue in degrees, wrapped into 0–360. */
const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;

/**
 * How the random actions draw: in HSV, as without constraints, or in OKLCH
 * within a hue arc, a relative chroma range and an avoided arc. A row of
 * colors drawn from a fixed seed shows what the settings give.
 */
function ConstraintControls() {
    const settings = usePlaygroundSettings();
    const {
        randomSpace,
        hueCenter,
        hueWidth,
        chromaMin,
        chromaMax,
        avoidOliveAndLime,
    } = settings;
    const oklch = randomSpace === RandomSpaces.oklch;
    const from = wrapHue(hueCenter - hueWidth / 2);
    const to = wrapHue(hueCenter + hueWidth / 2);
    return (
        <>
            <Field
                label="Draw in"
                className="@xl:col-span-2"
                description={
                    oklch ? (
                        <>
                            The random actions pass <Code>constraints</Code>:
                            hue uniform in OKLCH over the hues allowed, relative
                            chroma (0 grey, 1 as saturated as sRGB allows at the
                            hue and brightness) uniform within its range.
                        </>
                    ) : (
                        <>
                            Uniform in HSV, as without <Code>constraints</Code>:
                            more greens than golds, and a share of greys and
                            pastels.
                        </>
                    )
                }
            >
                <Segmented
                    label="Draw random colors in"
                    value={randomSpace}
                    onChange={(next) => updateSettings({ randomSpace: next })}
                    options={[
                        {
                            value: RandomSpaces.hsv,
                            label: 'HSV',
                            title: 'Draw in HSV, without constraints',
                        },
                        {
                            value: RandomSpaces.oklch,
                            label: 'OKLCH, within limits',
                            title: 'Draw in OKLCH, within constraints',
                        },
                    ]}
                    className="grid-cols-2"
                />
            </Field>
            {oklch && (
                <>
                    <Field
                        label="Hue"
                        value={`${hueCenter}°`}
                        description={
                            <>
                                The middle of the hues allowed: the{' '}
                                <Code>center</Code> of a <Code>HueRange</Code>{' '}
                                in <Code>hues</Code>.
                            </>
                        }
                    >
                        {(id) => (
                            <Slider
                                id={id}
                                {...RANGES.hueCenter}
                                value={hueCenter}
                                disabled={hueWidth >= 360}
                                aria-valuetext={`${hueCenter} degrees`}
                                style={
                                    { '--track': HUE_TRACK } as CSSProperties
                                }
                                onChange={(event) =>
                                    updateSettings({
                                        hueCenter: Number(event.target.value),
                                    })
                                }
                            />
                        )}
                    </Field>
                    <Field
                        label="Hue width"
                        value={
                            hueWidth >= 360
                                ? 'every hue'
                                : `${hueWidth}°, ${formatNumber(from)}° to ${formatNumber(to)}°`
                        }
                        description={
                            <>
                                Its <Code>width</Code>: how many degrees of hue,
                                around the middle. 360 is every hue.
                            </>
                        }
                    >
                        {(id) => (
                            <Slider
                                id={id}
                                {...RANGES.hueWidth}
                                value={hueWidth}
                                aria-valuetext={
                                    hueWidth >= 360
                                        ? 'every hue'
                                        : `${hueWidth} degrees`
                                }
                                onChange={(event) =>
                                    updateSettings({
                                        hueWidth: Number(event.target.value),
                                    })
                                }
                            />
                        )}
                    </Field>
                    <Field
                        label="Min chroma"
                        value={formatNumber(chromaMin)}
                        description={
                            <>
                                <Code>chroma.min</Code>: 0.5 or more leaves out
                                greys and pastels.
                            </>
                        }
                    >
                        {(id) => (
                            <Slider
                                id={id}
                                {...RANGES.chroma}
                                value={chromaMin}
                                aria-valuetext={formatNumber(chromaMin)}
                                onChange={(event) => {
                                    const min = Number(event.target.value);
                                    updateSettings({
                                        chromaMin: min,
                                        chromaMax: Math.max(min, chromaMax),
                                    });
                                }}
                            />
                        )}
                    </Field>
                    <Field
                        label="Max chroma"
                        value={formatNumber(chromaMax)}
                        description={
                            <>
                                <Code>chroma.max</Code>: lower for muted tints
                                and tones.
                            </>
                        }
                    >
                        {(id) => (
                            <Slider
                                id={id}
                                {...RANGES.chroma}
                                value={chromaMax}
                                aria-valuetext={formatNumber(chromaMax)}
                                onChange={(event) => {
                                    const max = Number(event.target.value);
                                    updateSettings({
                                        chromaMax: max,
                                        chromaMin: Math.min(max, chromaMin),
                                    });
                                }}
                            />
                        )}
                    </Field>
                    <div className="@xl:col-span-2">
                        <SwitchField
                            label="Avoid olive and lime"
                            description={
                                <>
                                    <Code>avoid: [hueArc(95, 135)]</Code>: the
                                    hues from 95° to 135° are taken out (unless
                                    that would leave none).
                                </>
                            }
                            checked={avoidOliveAndLime}
                            onChange={(checked) =>
                                updateSettings({ avoidOliveAndLime: checked })
                            }
                        />
                    </div>
                </>
            )}
            <DrawPreview settings={settings} />
        </>
    );
}

/** How many colors the preview draws. */
const PREVIEW_COLORS = 24;

/**
 * Colors drawn as the random actions would draw them, from a fixed seed, so
 * the row changes only with the settings.
 */
function DrawPreview({ settings }: { settings: PlaygroundSettings }) {
    const { minBrightness } = settings;
    // the constraint is rebuilt with every change of settings: its JSON says when it differs
    const constraintKey = JSON.stringify(randomConstraint(settings) ?? null);
    const hexes = useMemo(() => {
        const constraint = JSON.parse(constraintKey) ?? undefined;
        const random = seededRandom('preview');
        return Array.from({ length: PREVIEW_COLORS }, () =>
            randomColor({ random, minBrightness, constraint }).hex(),
        );
    }, [minBrightness, constraintKey]);
    return (
        <Field
            label="Drawn so"
            className="@xl:col-span-2"
            description={
                <>
                    {PREVIEW_COLORS} colors from <Code>randomColor</Code> with
                    these settings and a fixed seed.
                </>
            }
        >
            <div
                className="grid grid-cols-12 gap-1 @md:grid-cols-24"
                role="img"
                aria-label={`${PREVIEW_COLORS} colors drawn with these settings`}
            >
                {hexes.map((hex, i) => (
                    <div
                        key={i}
                        className="aspect-square rounded-sm"
                        style={{ backgroundColor: hex }}
                        title={hex}
                    />
                ))}
            </div>
        </Field>
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
                ...randomOptions(settings),
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
