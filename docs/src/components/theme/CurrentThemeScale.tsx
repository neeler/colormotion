import { useThemeScale } from '~/hooks/useThemeScale';

export function CurrentThemeScale() {
    const themeScale = useThemeScale();

    return (
        <div className="flex h-9 w-full max-w-full justify-center overflow-hidden rounded-lg">
            {themeScale?.colors.map((color, index) => (
                <span
                    key={`${color}-${index}`}
                    className="h-full grow"
                    style={{ backgroundColor: color.hex() }}
                />
            ))}
        </div>
    );
}
