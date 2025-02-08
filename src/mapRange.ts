/**
 * The function should be a single-arg function that expects values in the range [0,1]
 * and returns a corresponding value in the same range.
 */
export function mapRange({
    inRange,
    outRange,
}: {
    inRange: [number, number];
    outRange: [number, number];
}) {
    const inWidth = inRange[1] - inRange[0];
    const outWidth = outRange[1] - outRange[0];

    return (value: number) => {
        const clampedValue = Math.min(Math.max(value, inRange[0]), inRange[1]);
        const valueInOriginalRange = (clampedValue - inRange[0]) / inWidth;
        return outRange[0] + outWidth * valueInOriginalRange;
    };
}
