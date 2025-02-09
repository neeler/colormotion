export function rotateCoordinates({
    x = 0,
    y = 0,
    angle = 0,
}: {
    x?: number;
    y?: number;
    angle?: number;
}) {
    return {
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle),
    };
}
