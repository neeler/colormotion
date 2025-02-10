/**
 * Clamps a value between a minimum and maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
    if (min > max) {
        [min, max] = [max, min];
    }
    return Math.min(Math.max(value, min), max);
}
