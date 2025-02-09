import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function RotateModeButton({ className }: { className?: string }) {
    return (
        <Button
            className={className}
            color="dark"
            onClick={() => {
                theme.rotateMode();
            }}
        >
            Rotate Interpolation Mode
        </Button>
    );
}
