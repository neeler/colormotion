import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function PopOldestColorButton({ className }: { className?: string }) {
    return (
        <Button
            className={className}
            color="zinc"
            onClick={() => {
                theme.popOldestColor();
            }}
        >
            Pop Oldest Color
        </Button>
    );
}
