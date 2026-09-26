import { chroma } from '@colormotion';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlusIcon } from '~/components/icons/PlusIcon';
import { XMarkIcon } from '~/components/icons/XMarkIcon';
import {
    getSettings,
    transitionOptions,
} from '~/components/playground/settings';
import { getTheme, MAX_NUMBER_OF_COLORS } from '~/components/theme/theme';
import { useThemeScale } from '~/hooks/useThemeScale';

function setColors(colors: string[]) {
    getTheme().setColors(colors, transitionOptions());
}

/**
 * The active palette's colors, editable in place: click a color to change it,
 * × to remove it and + to add one.
 */
export function PaletteEditor({ className }: { className?: string }) {
    const palette = useThemeScale()?.palette;
    const hexes = palette ? palette.hexes.slice(0, palette.nColors) : [];
    const isFull = hexes.length >= MAX_NUMBER_OF_COLORS;
    // the color + just added, whose picker opens once its swatch is shown
    const [pickIndex, setPickIndex] = useState<number | undefined>(undefined);
    const clearPickIndex = useCallback(() => setPickIndex(undefined), []);

    return (
        <div className={clsx(className, 'flex h-10 gap-1.5 sm:h-9 @xl:gap-2')}>
            {hexes.map((hex, index) => (
                <Swatch
                    key={index}
                    hex={hex}
                    pick={index === pickIndex}
                    onPicked={clearPickIndex}
                    onChange={(next) =>
                        setColors(
                            hexes.map((color, i) =>
                                i === index ? next : color,
                            ),
                        )
                    }
                    onRemove={
                        hexes.length > 1
                            ? () =>
                                  setColors(hexes.filter((_, i) => i !== index))
                            : undefined
                    }
                />
            ))}
            <button
                type="button"
                disabled={!palette || isFull}
                aria-label="Add a color"
                title={
                    isFull
                        ? `Palettes here hold up to ${MAX_NUMBER_OF_COLORS} colors`
                        : 'Add a color: a random one, to change as you like'
                }
                onClick={() => {
                    const settings = getSettings();
                    getTheme().pushRandomColor({
                        minBrightness: settings.minBrightness,
                        ...transitionOptions(settings),
                    });
                    setPickIndex(hexes.length);
                }}
                className="flex aspect-square h-full shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/25 text-zinc-400 hover:border-white/50 hover:text-white focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/25 disabled:hover:text-zinc-400"
            >
                <PlusIcon className="size-5" />
            </button>
        </div>
    );
}

function Swatch({
    hex,
    pick,
    onPicked,
    onChange,
    onRemove,
}: {
    hex: string;
    /** Opens the color picker, where the browser allows it. */
    pick: boolean;
    onPicked: () => void;
    onChange: (hex: string) => void;
    onRemove?: () => void;
}) {
    const color = chroma(hex);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!pick) return;
        try {
            inputRef.current?.showPicker();
        } catch {
            // not supported here, or too long after the click: the swatch
            // can still be clicked
        }
        onPicked();
    }, [pick, onPicked]);

    return (
        <div className="group/swatch relative min-w-0 flex-1">
            <label
                title={`${hex}: click to change`}
                className="relative flex h-full cursor-pointer items-center justify-center rounded-lg ring-1 ring-white/10 ring-inset has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-500"
                style={{ backgroundColor: hex }}
            >
                <input
                    ref={inputRef}
                    type="color"
                    value={color.hex('rgb')}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={`Change ${hex}`}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span
                    className={clsx(
                        'pointer-events-none hidden truncate px-1 text-xs/5 font-semibold @xl:block @2xl:text-sm/6',
                        color.luminance() > 0.4
                            ? 'text-black/80'
                            : 'text-white/90',
                    )}
                >
                    {hex}
                </span>
            </label>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`Remove ${hex}`}
                    title="Remove"
                    className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-zinc-300 opacity-0 ring-1 ring-white/25 transition-opacity group-hover/swatch:opacity-100 hover:text-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-500 [@media(pointer:coarse)]:-top-2 [@media(pointer:coarse)]:-right-2 [@media(pointer:coarse)]:size-6 [@media(pointer:coarse)]:opacity-100"
                >
                    <XMarkIcon className="size-3.5" />
                </button>
            )}
        </div>
    );
}
