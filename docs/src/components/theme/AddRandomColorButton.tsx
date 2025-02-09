import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function AddRandomColorButton({
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
                theme.pushRandomColor({
                    minBrightness,
                });
            }}
        >
            Add Random Color
        </Button>
    );
}
