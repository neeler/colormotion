import { ColorUpdateConfig } from 'colormotion';
import { Button } from '~/components/catalyst/Button';
import { theme } from '~/components/theme/theme';

export function RandomThemeButton(options: ColorUpdateConfig) {
    return (
        <Button
            onClick={() => {
                theme.randomTheme(options);
            }}
        >
            Randomize
        </Button>
    );
}
