import { Sketch } from '~/components/sketches/Sketch';

export const testSketch = new Sketch({
    setup: (p5) => {
        p5.createCanvas(600, 400, p5.WEBGL);
    },
    draw: (p5) => {
        p5.background(250);
        p5.normalMaterial();
        p5.push();
        p5.rotateZ(p5.frameCount * 0.01);
        p5.rotateX(p5.frameCount * 0.01);
        p5.rotateY(p5.frameCount * 0.01);
        p5.plane(100);
        p5.pop();
    },
});
