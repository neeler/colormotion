import { Sketch } from '~/components/sketches/lib';
import { theme } from '~/components/theme/theme';
import { MovingObject } from '~/lib/MovingObject';
import { MovingRandomNumber } from '~/lib/MovingRandomNumber';

export const traceSketch = new Sketch({
    state: () => ({
        shapes: Array<[number, number]>(),
        alphaFade: 0.001,
        radiusFade: 0.003,
    }),
    movingState: () =>
        new MovingObject({
            rotation: new MovingRandomNumber({
                min: -300,
                max: 300,
            }),
            colorStep: new MovingRandomNumber({
                min: -60,
                max: 60,
            }),
            fade: new MovingRandomNumber({
                min: 0.005,
                max: 0.015,
            }),
            autoMouseX: new MovingRandomNumber({
                min: 0,
                max: 1,
            }),
            autoMouseY: new MovingRandomNumber({
                min: 0,
                max: 1,
            }),
            bgOpacity: new MovingRandomNumber({
                min: 25,
                max: 255,
            }),
        }),
    setup: (p5, { state }) => {
        p5.background(0);
        p5.noStroke();
        p5.angleMode(p5.DEGREES);
        state.shapes.length = 0;
    },
    draw: (
        p5,
        {
            state,
            movingState: {
                rotation,
                colorStep,
                fade,
                autoMouseX,
                autoMouseY,
                bgOpacity,
            },
        },
    ) => {
        p5.background(0, 0, 0, bgOpacity);

        let sliceIndex = state.shapes.length;
        const baseSize = Math.min(20, 0.033 * Math.min(p5.width, p5.height));

        for (let i = state.shapes.length - 1; i >= 0; i--) {
            const [x, y] = state.shapes[i];
            const alpha = 255 * (1 - state.alphaFade) ** i;
            const size = baseSize * (1 - fade) ** i;
            if (alpha <= 0 || size < 5) {
                sliceIndex = i;
            } else {
                p5.push();
                p5.translate(p5.width / 2, p5.height / 2);
                p5.rotate(rotation * i);
                p5.fill(...theme.getColor(i * colorStep).rgb(), alpha);
                p5.ellipse(
                    x * (1 - state.radiusFade) ** i,
                    y * (1 - state.radiusFade) ** i,
                    size,
                );
                p5.pop();
            }
        }

        p5.fill(...theme.getColor().rgb());
        const mouseInBounds =
            p5.mouseX > 0 &&
            p5.mouseX < p5.width &&
            p5.mouseY > 0 &&
            p5.mouseY < p5.height;
        const xPos =
            (mouseInBounds ? p5.mouseX : autoMouseX * p5.width) - p5.width / 2;
        const yPos =
            (mouseInBounds ? p5.mouseY : autoMouseY * p5.height) -
            p5.height / 2;
        state.shapes.unshift([xPos, yPos]);
        state.shapes.length = sliceIndex + 1;
        p5.push();
        p5.translate(p5.width / 2, p5.height / 2);
        p5.ellipse(xPos, yPos, baseSize);
        p5.pop();

        theme.tick(5);
    },
});
