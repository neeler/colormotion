import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function RandomThemeButton({
    minBrightness,
    className,
}: {
    minBrightness?: number;
    className?: string;
}) {
    return (
        <Button
            className={className}
            color="zinc"
            onClick={() => {
                theme.randomTheme({
                    minBrightness,
                });
            }}
        >
            Full Random Theme
        </Button>
    );
}
