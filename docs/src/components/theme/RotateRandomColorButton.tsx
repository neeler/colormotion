import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function RotateRandomColorButton({
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
                theme.rotateRandomColor({
                    minBrightness,
                });
            }}
        >
            Rotate In Random Color
        </Button>
    );
}
