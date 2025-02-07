import { MovingThing } from '~/lib/MovingThing';
import { onceEvery } from '~/lib/onceEvery';

const velocityAmp = (min: number, max: number, manualAmp: number | null) =>
    (manualAmp ?? Math.abs(max - min)) / 200000;
const accelerationAmp = (min: number, max: number, manualAmp: number | null) =>
    (manualAmp ?? Math.abs(max - min)) / 2000000;
const randomNumberInSymmetricalRange = (amp: number) =>
    Math.random() * 2 * amp - amp;

interface MovingRandomNumberConfig {
    initialValue?: number;
    min: number;
    max: number;
    manualAmp?: number;
    randomFactor?: number;
    speedFactor?: number;
    wrap?: boolean;
}

export class MovingRandomNumber implements MovingThing<number> {
    private value: number;
    private velocity: number;
    private acceleration: number;
    private readonly manualAmp: number | null;
    private readonly min: number;
    private readonly max: number;
    private readonly randomFactor: number;
    private readonly speedFactor: number;
    private readonly delta: number;
    private readonly wrap: boolean;

    constructor({
        initialValue,
        min,
        max,
        manualAmp: inputAmp,
        randomFactor = 100,
        speedFactor = 1,
        wrap = false,
    }: MovingRandomNumberConfig) {
        const useManualSpeed =
            inputAmp !== undefined ||
            ((sum) => sum === Infinity || Number.isNaN(sum))(
                Math.abs(min + max),
            );
        this.manualAmp = useManualSpeed ? (inputAmp ?? 0) : null;
        this.min = min;
        this.max = max;
        this.delta = max - min;
        this.value = initialValue ?? Math.random() * (max - min) + min;
        this.velocity = randomNumberInSymmetricalRange(
            velocityAmp(min, max, this.manualAmp),
        );
        this.speedFactor = speedFactor;
        this.acceleration = randomNumberInSymmetricalRange(
            accelerationAmp(min, max, this.manualAmp) * speedFactor,
        );
        this.randomFactor = randomFactor;
        this.wrap = wrap;
    }

    get() {
        return this.value;
    }

    getNormalized() {
        return (this.value - this.min) / this.delta;
    }

    tick() {
        let nextValue;
        if (this.wrap) {
            nextValue = ((this.value + this.velocity) % this.delta) + this.min;

            if (onceEvery(this.randomFactor)) {
                this.acceleration = randomNumberInSymmetricalRange(
                    accelerationAmp(this.min, this.max, this.manualAmp) *
                        this.speedFactor,
                );
            }
        } else {
            nextValue = Math.min(
                this.max,
                Math.max(this.min, this.value + this.velocity),
            );

            if (nextValue === this.min || nextValue === this.max) {
                this.velocity = -this.velocity;
                this.acceleration = randomNumberInSymmetricalRange(
                    accelerationAmp(this.min, this.max, this.manualAmp) *
                        this.speedFactor,
                );
            } else if (onceEvery(this.randomFactor)) {
                this.acceleration = randomNumberInSymmetricalRange(
                    accelerationAmp(this.min, this.max, this.manualAmp) *
                        this.speedFactor,
                );
            }
        }

        this.value = nextValue;
        this.velocity += this.acceleration;
    }
}
