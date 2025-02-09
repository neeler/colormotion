import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function DropOldestColorButton({ className }: { className?: string }) {
    return (
        <Button
            className={className}
            color="zinc"
            onClick={() => {
                theme.popOldestColor();
            }}
        >
            Drop Oldest Color
        </Button>
    );
}
