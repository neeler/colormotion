import clsx from 'clsx';
import { useThemeScale } from '~/hooks/useThemeScale';

export function CurrentPalette() {
    const themeScale = useThemeScale();

    return (
        <div className="flex space-x-2">
            {themeScale?.palette.colors.map((color, index) => (
                <div
                    key={`${color}-${index}`}
                    className={clsx(
                        'grow text-black',
                        // Base
                        'relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg text-base/6 font-semibold',
                        // Sizing
                        'px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6',
                    )}
                    style={{ backgroundColor: color.hex() }}
                >
                    {color.hex('rgb')}
                </div>
            ))}
        </div>
    );
}
