import clsx from 'clsx';
import { useThemeScale } from '~/hooks/useThemeScale';

export function CurrentPalette({ className }: { className?: string }) {
    const themeScale = useThemeScale();

    return (
        <div className={clsx('flex h-9 lg:space-x-2', className)}>
            {themeScale?.palette.colors.map((color, index) => (
                <div
                    key={`${color}-${index}`}
                    className="h-full grow rounded-lg border border-black"
                    style={{ backgroundColor: color.hex() }}
                >
                    <div
                        key={`${color}-${index}`}
                        className={clsx(
                            'h-full w-full text-black',
                            // Base
                            'relative isolate hidden items-center justify-center gap-x-2 text-base/6 font-semibold lg:inline-flex',
                            // Sizing
                            'px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6',
                        )}
                    >
                        {color.hex('rgb')}
                    </div>
                </div>
            ))}
        </div>
    );
}
