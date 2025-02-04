import { mapRange } from './mapRange';

/**
 * Maps a brightness value (1-255) to a darken factor (3-0).
 */
export const mapBrightnessToDarkenFactor = mapRange({
    inRange: [1, 255],
    outRange: [3, 0],
});
