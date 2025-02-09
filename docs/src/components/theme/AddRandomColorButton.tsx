import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';
import { useNColors } from '~/hooks/useNColors';

export function AddRandomColorButton({
    minBrightness,
    className,
}: {
    minBrightness?: number;
    className?: string;
}) {
    const nColors = useNColors();
    return (
        <Button
            className={className}
            color="zinc"
            disabled={
                nColors !== undefined && nColors >= theme.maxNumberOfColors
            }
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
