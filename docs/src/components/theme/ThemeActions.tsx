import clsx from 'clsx';
import { Button } from '~/components/catalyst/Button';
import {
    getSettings,
    transitionOptions,
} from '~/components/playground/settings';
import { getTheme, MAX_NUMBER_OF_COLORS } from '~/components/theme/theme';
import { useNColors } from '~/hooks/useNColors';

/**
 * The theme's random and palette-shifting updates, with the playground's
 * random and transition settings.
 */
export function ThemeActions({ className }: { className?: string }) {
    const nColors = useNColors();

    const actions = [
        {
            label: 'Random theme',
            call: 'theme.randomTheme()',
            run: () => {
                const settings = getSettings();
                getTheme().randomTheme({
                    nColors: settings.nColors,
                    minBrightness: settings.minBrightness,
                    ...transitionOptions(settings),
                });
            },
        },
        {
            label: 'Rotate in random',
            call: 'theme.rotateRandomColor()',
            run: () => {
                const settings = getSettings();
                getTheme().rotateRandomColor({
                    minBrightness: settings.minBrightness,
                    ...transitionOptions(settings),
                });
            },
        },
        {
            label: 'Add random',
            call: 'theme.pushRandomColor()',
            disabled: nColors !== undefined && nColors >= MAX_NUMBER_OF_COLORS,
            run: () => {
                const settings = getSettings();
                getTheme().pushRandomColor({
                    minBrightness: settings.minBrightness,
                    ...transitionOptions(settings),
                });
            },
        },
        {
            label: 'Drop oldest',
            call: 'theme.popOldestColor()',
            disabled: nColors !== undefined && nColors <= 1,
            run: () => {
                getTheme().popOldestColor(transitionOptions());
            },
        },
    ];

    return (
        <div
            className={clsx(
                className,
                'grid grid-cols-1 gap-2 @xs:grid-cols-2 @2xl:grid-cols-4',
            )}
        >
            {actions.map(({ label, call, disabled, run }) => (
                <Button
                    key={label}
                    color="zinc"
                    title={call}
                    disabled={disabled}
                    onClick={run}
                >
                    {label}
                </Button>
            ))}
        </div>
    );
}
