import clsx from 'clsx';
import { InterpolationMode } from 'colormotion';
import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function ModeButton({
    mode,
    activeMode,
    className,
}: {
    mode: InterpolationMode;
    activeMode?: InterpolationMode;
    className?: string;
}) {
    return (
        <Button
            className={clsx(className, 'uppercase')}
            color="dark"
            onClick={() => {
                theme.setMode(mode);
            }}
            style={{
                borderColor: mode === activeMode ? '#cccccc' : undefined,
            }}
        >
            {mode}
        </Button>
    );
}
