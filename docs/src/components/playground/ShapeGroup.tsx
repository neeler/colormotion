import {
    adjacentConstraints,
    analyzeTheme,
    randomLike,
    ThemeAnalysis,
} from '@colormotion';
import { useMemo } from 'react';
import { Button } from '~/components/catalyst/Button';
import { Code } from '~/components/catalyst/Text';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import {
    getSettings,
    transitionOptions,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { getTheme, getThemeSnapshot } from '~/components/theme/theme';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useThemeScale } from '~/hooks/useThemeScale';

/** A relationship as the readout names it. */
const LABELS: Record<ThemeAnalysis['relationship'], string> = {
    neutral: 'neutral',
    family: 'family',
    accent: 'accent',
    contrast: 'contrast',
    bridge: 'bridge',
    'pair-accent': 'pair and accent',
    triad: 'triad',
    spectrum: 'spectrum',
};

/**
 * The analysis of the palette's colors (the target while transitioning), as
 * shown at the Randomness group's minimum brightness.
 */
function useAnalysis() {
    const palette = useThemeScale()?.palette;
    const { minBrightness } = usePlaygroundSettings();
    const key = palette ? palette.hexes.slice(0, palette.nColors).join() : '';
    return useMemo(() => {
        if (!key) return undefined;
        const hexes = key.split(',');
        return { hexes, analysis: analyzeTheme(hexes, { minBrightness }) };
    }, [key, minBrightness]);
}

export function ShapeGroup() {
    const shape = useAnalysis();
    const analysis = shape?.analysis;
    return (
        <ControlGroup
            title="Shape"
            summary={
                analysis &&
                `${LABELS[analysis.relationship]} · ${analysis.groups.length} ${
                    analysis.groups.length === 1 ? 'group' : 'groups'
                }`
            }
        >
            {shape && <ShapeControls {...shape} />}
        </ControlGroup>
    );
}

/** The random the playground's theme draws with: its seed's, or Math.random. */
function playgroundRandom() {
    return getThemeSnapshot().generator?.random ?? Math.random;
}

function ShapeControls({
    analysis,
    hexes,
}: {
    analysis: ThemeAnalysis;
    hexes: string[];
}) {
    const { minBrightness } = usePlaygroundSettings();
    const actions = [
        {
            label: 'Adjacent roll',
            call: 'theme.rotateRandomColor({ constraints: adjacentConstraints(analysis) })',
            run: () => {
                const settings = getSettings();
                getTheme().rotateRandomColor({
                    minBrightness: settings.minBrightness,
                    constraints: adjacentConstraints(analysis),
                    ...transitionOptions(settings),
                });
            },
        },
        {
            label: 'Random like',
            call: 'theme.setColors(randomLike(analysis).colors)',
            run: () => {
                const settings = getSettings();
                const { colors } = randomLike(analysis, {
                    random: playgroundRandom(),
                    minBrightness: settings.minBrightness,
                    deltaEThreshold: getThemeSnapshot().options.deltaEThreshold,
                });
                getTheme().setColors(colors, transitionOptions(settings));
            },
        },
    ];
    return (
        <div className="space-y-4">
            <Field
                label="Relationship"
                value={LABELS[analysis.relationship]}
                description={
                    <>
                        <Code>analyzeTheme</Code> of the palette, measured at
                        min brightness {formatNumber(minBrightness)}
                        {analysis.anchor !== null &&
                            `: anchored at ${Math.round(analysis.anchor)}°, spanning ${Math.round(analysis.span)}°`}
                        .
                    </>
                }
            >
                <Groups analysis={analysis} hexes={hexes} />
            </Field>
            <div className="space-y-1.5">
                <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
                    {actions.map(({ label, call, run }) => (
                        <Button
                            key={label}
                            color="zinc"
                            title={call}
                            onClick={run}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
                <p className="text-sm/5 text-zinc-500">
                    Adjacent roll replaces the oldest color with one near the
                    color in its position; Random like draws a palette in the
                    same relationship at another hue. Both use the Randomness
                    settings.
                </p>
            </div>
        </div>
    );
}

/** Each hue group's colors, from the anchor's, with its hue; then the neutrals. */
function Groups({
    analysis,
    hexes,
}: {
    analysis: ThemeAnalysis;
    hexes: string[];
}) {
    const swatch = (index: number) => {
        const hex = hexes[index]!;
        return (
            <div
                key={index}
                className="size-6 rounded-sm ring-1 ring-white/10"
                style={{ backgroundColor: hex }}
                title={`${hex}: ${analysis.picks[index]!.role}`}
            />
        );
    };
    const rows = [
        ...analysis.groups.map((group, g) => ({
            key: `group-${g}`,
            label: `${Math.round(group.center)}°${g === 0 ? ' (anchor)' : ''}`,
            members: group.members,
        })),
        ...(analysis.neutrals.length
            ? [
                  {
                      key: 'neutrals',
                      label: 'neutral',
                      members: analysis.neutrals,
                  },
              ]
            : []),
    ];
    return (
        <div className="space-y-1.5" role="list" aria-label="Hue groups">
            {rows.map(({ key, label, members }) => (
                <div
                    key={key}
                    role="listitem"
                    className="flex items-center gap-2"
                >
                    <span className="w-24 shrink-0 text-sm/6 text-zinc-400 tabular-nums">
                        {label}
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {members.map(swatch)}
                    </div>
                </div>
            ))}
        </div>
    );
}
