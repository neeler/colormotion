import { useThemeScale } from '~/hooks/useThemeScale';

export function CurrentThemeScale() {
    const themeScale = useThemeScale();

    return (
        <div className="flex">
            {themeScale?.colors.map((color, index) => (
                <div
                    key={`${color}-${index}`}
                    className="h-8 grow"
                    style={{ backgroundColor: color.hex() }}
                />
            ))}
        </div>
    );
}
