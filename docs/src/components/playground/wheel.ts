import { getSettings, WHEEL_DRIFT } from '~/components/playground/settings';
import { getTheme } from '~/components/theme/theme';
import { MovingRandomNumber } from '~/lib/MovingRandomNumber';

const drift = new MovingRandomNumber({
    min: WHEEL_DRIFT.min,
    max: WHEEL_DRIFT.max,
});

/**
 * Advances the theme by a frame: theme.tick(n) with the playground's wheel
 * speed, drifting if asked, or 0 when paused (which still advances a
 * transition). The sketches call it once at the end of every draw.
 */
export function tickTheme() {
    const { wheelSpeed, wheelDrift, paused } = getSettings();
    const n = paused ? 0 : wheelSpeed * (wheelDrift ? drift.get() : 1);
    getTheme().tick(n);
    drift.tick();
}
