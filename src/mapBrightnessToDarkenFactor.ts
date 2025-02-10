import { mapRange } from './mapRange';

/**
 * Maps a brightness value (0-1) to a darken factor (3-0).
 */
export const mapBrightnessToDarkenFactor = mapRange({
    inRange: [0, 1],
    outRange: [3, 0],
});
