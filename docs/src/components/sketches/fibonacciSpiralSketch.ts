import { Sketch } from '~/components/sketches/lib';
import { theme } from '~/components/theme/theme';
import { MovingObject } from '~/lib/MovingObject';
import { MovingRandomNumber } from '~/lib/MovingRandomNumber';

const goldenAngle = Math.PI * (3 - 5 ** 0.5);

const radiusCache = new Map<number, number>();
function getFibonacciSpiralRadius(i: number) {
    const cachedData = radiusCache.get(i);
    if (cachedData) return cachedData;

    const radius = i ** 0.5;
    radiusCache.set(i, radius);
    return radius;
}

const angleCache = new Map<number, number>();
function getFibonacciSpiralAngle(i: number) {
    const cachedData = angleCache.get(i);
    if (cachedData) return cachedData;

    const angle = i * goldenAngle;
    angleCache.set(i, angle);
    return angle;
}

export const fibonacciSpiralSketch = new Sketch({
    state: () => {},
    movingState: () =>
        new MovingObject({
            bgOpacity: new MovingRandomNumber({
                min: 10,
                max: 10,
            }),
            shapeOpacity: new MovingRandomNumber({
                min: 200,
                max: 255,
            }),
            colorTurnStep: new MovingRandomNumber({
                min: 1,
                max: 10,
            }),
            iColorStep: new MovingRandomNumber({
                min: 0,
                max: 2,
            }),
            rColorStep: new MovingRandomNumber({
                min: 0,
                max: 1,
            }),
            angleColorStep: new MovingRandomNumber({
                min: 0,
                max: 2,
            }),
            frameOpacityFactor: new MovingRandomNumber({
                min: 0,
                max: 1,
            }),
            scaleRatio: new MovingRandomNumber({
                min: 30,
                max: 60,
            }),
            nDotsBase: new MovingRandomNumber({
                min: 40,
                max: 70,
            }),
        }),
    setup: (p5) => {
        p5.background(0);
    },
    draw: (
        p5,
        {
            movingState: {
                bgOpacity,
                shapeOpacity,
                colorTurnStep,
                iColorStep,
                rColorStep,
                angleColorStep,
                frameOpacityFactor,
                scaleRatio,
                nDotsBase,
            },
        },
    ) => {
        p5.background(0, 0, 0, bgOpacity);

        const midWidth = p5.width / 2;
        const midHeight = p5.height / 2;
        const maxSize = Math.max(midWidth, midHeight);
        const spiralScale = (1.1 * maxSize) / scaleRatio;
        const dotSize = Math.floor(maxSize / 40);

        p5.translate(midWidth, midHeight);
        p5.rotate(p5.frameCount * 0.001);
        const nDots = nDotsBase * scaleRatio;

        p5.push();
        p5.noStroke();
        for (let i = 0; i < nDots; i++) {
            const radius = spiralScale * getFibonacciSpiralRadius(i);
            const angle = getFibonacciSpiralAngle(i);
            const color = theme.getColor(
                i * iColorStep + radius * rColorStep + angleColorStep * angle,
            );
            const iFrame = (p5.frameCount * 10) % nDots;
            const frameDiff = Math.abs(i - iFrame) / nDots;
            p5.rotate(goldenAngle);
            const [r, g, b] = color.rgb();
            p5.fill(
                r,
                g,
                b,
                (1 + frameOpacityFactor * frameDiff) * shapeOpacity,
            );
            p5.ellipse(0, radius, dotSize);
        }
        p5.pop();

        theme.tick(Math.round(colorTurnStep));
    },
});
