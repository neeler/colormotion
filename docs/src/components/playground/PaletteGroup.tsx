import { chroma } from '@colormotion';
import { useState } from 'react';
import { Button } from '~/components/catalyst/Button';
import { Code } from '~/components/catalyst/Text';
import { Textarea } from '~/components/catalyst/Textarea';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { transitionOptions } from '~/components/playground/settings';
import { getTheme, MAX_NUMBER_OF_COLORS } from '~/components/theme/theme';
import { useNColors } from '~/hooks/useNColors';
import { useThemeScale } from '~/hooks/useThemeScale';

const PRESETS: { name: string; colors: string[] }[] = [
    {
        name: 'Rainbow',
        colors: [
            'red',
            'orange',
            'yellow',
            'green',
            'blue',
            'indigo',
            'violet',
        ],
    },
    { name: 'RGB', colors: ['red', 'lime', 'blue'] },
    {
        name: 'Sunset',
        colors: ['#ff5e62', '#ff9966', '#ffd166', '#c9406a', '#5b2a86'],
    },
    { name: 'Ocean', colors: ['#00c2ff', '#0059ff', '#00ffc8', '#003a70'] },
    { name: 'Embers', colors: ['#ff2a00', '#ff8c00', '#ffd200', '#8b0000'] },
    { name: 'Warm white', colors: ['#ff9329', '#ffc58f', '#fff1e0'] },
];

/**
 * Color strings in text: CSS functions such as rgb(0, 0, 255) whole, and
 * anything else split on commas, spaces and new lines.
 */
function parseColors(text: string) {
    return text.match(/[a-z]+\([^)]*\)?|[^\s,()]+/gi) ?? [];
}

function setColors(colors: string[]) {
    getTheme().setColors(colors, transitionOptions());
}

export function PaletteGroup() {
    const nColors = useNColors();
    return (
        <ControlGroup
            title="Palette"
            summary={
                nColors === undefined
                    ? undefined
                    : `${nColors} of ${MAX_NUMBER_OF_COLORS} colors`
            }
        >
            <div className="space-y-4">
                <ColorList />
                <Presets />
            </div>
        </ControlGroup>
    );
}

function ColorList() {
    const palette = useThemeScale()?.palette;
    const current = palette
        ? palette.hexes.slice(0, palette.nColors).join(', ')
        : '';
    const [draft, setDraft] = useState<string | undefined>(undefined);
    const [message, setMessage] = useState<
        { text: string; isError?: boolean } | undefined
    >(undefined);
    const text = draft ?? current;

    const apply = () => {
        const colors = parseColors(text);
        const invalid = colors.filter((color) => !chroma.valid(color));
        if (!colors.length) {
            setMessage({ text: 'Enter at least one color.', isError: true });
            return;
        }
        if (invalid.length) {
            setMessage({
                text: `chroma.js can't read ${invalid.join(', ')}.`,
                isError: true,
            });
            return;
        }
        setColors(colors);
        setDraft(undefined);
        setMessage(
            colors.length > MAX_NUMBER_OF_COLORS
                ? {
                      text: `Palettes here hold ${MAX_NUMBER_OF_COLORS} colors, so the first ${MAX_NUMBER_OF_COLORS} are used.`,
                  }
                : undefined,
        );
    };

    return (
        <Field
            label="Colors"
            description={
                message ? (
                    <span className={message.isError ? 'text-red-400' : ''}>
                        {message.text}
                    </span>
                ) : (
                    <>
                        Type or paste hex codes, CSS names or any color
                        chroma.js reads, then press Enter. Applied with{' '}
                        <Code>theme.setColors</Code>.
                    </>
                )
            }
        >
            {(id) => (
                <div className="flex items-start gap-2">
                    <Textarea
                        id={id}
                        rows={2}
                        value={text}
                        invalid={message?.isError}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setMessage(undefined);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                apply();
                            }
                        }}
                        className="min-w-0 flex-1 font-mono"
                    />
                    <Button color="zinc" onClick={apply}>
                        Apply
                    </Button>
                </div>
            )}
        </Field>
    );
}

function Presets() {
    return (
        <div className="space-y-1.5">
            <p className="text-base/6 font-medium text-white sm:text-sm/6">
                Presets
            </p>
            <div className="flex flex-wrap gap-2">
                {PRESETS.map(({ name, colors }) => (
                    <button
                        key={name}
                        type="button"
                        title={colors.join(', ')}
                        onClick={() => setColors(colors)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pr-2.5 pl-1.5 text-sm/5 font-medium text-zinc-300 hover:border-white/20 hover:text-white focus:outline-hidden focus-visible:outline-2 focus-visible:outline-blue-500"
                    >
                        <span
                            className="h-4 w-8 rounded-sm"
                            style={{
                                background: `linear-gradient(to right, ${colors.join(', ')})`,
                            }}
                        />
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );
}
