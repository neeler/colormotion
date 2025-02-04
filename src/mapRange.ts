/**
 * The function should be a single-arg function that expects values in the range [0,1]
 * and returns a corresponding value in the same range.
 */
export function mapRange({
    fn = (x: number) => x,
    inRange = [0, 1],
    outRange,
}: {
    fn?: (xInOriginalRange: number) => number;
    inRange?: [number, number];
    outRange: [number, number];
}) {
    const inWidth = inRange[1] - inRange[0];
    const outWidth = outRange[1] - outRange[0];

    return (value: number) => {
        const valueInOriginalRange = fn((value - inRange[0]) / inWidth);
        return outRange[0] + outWidth * valueInOriginalRange;
    };
}
