import type p5Type from 'p5';
import { RefObject } from 'react';
import {
    P5AccelerationEvents,
    P5KeyboardEvents,
    P5MouseEvents,
    P5TouchEvents,
    SketchDefinition,
    SketchProps,
} from '~/components/sketches/types';

export class Sketch {
    private readonly sketchProps: SketchProps;

    constructor(sketchProps: SketchProps) {
        this.sketchProps = sketchProps;
    }

    get(wrapperRef: RefObject<HTMLElement | null>): SketchDefinition {
        const getWidth = () => wrapperRef.current?.clientWidth ?? 0;
        const getHeight = () => wrapperRef.current?.clientHeight ?? 0;

        let canvas: HTMLElement | null = null;

        return (p5: p5Type) => {
            const lastSeenSize = {
                width: getWidth(),
                height: getHeight(),
            };

            /**
             * Core functions
             */

            if (this.sketchProps.preload) {
                p5.preload = () => this.sketchProps.preload?.(p5);
            }

            p5.setup = () => {
                const wrapper = wrapperRef.current;
                if (!wrapper) return;

                lastSeenSize.width = getWidth();
                lastSeenSize.height = getHeight();

                const p5Canvas = p5
                    .createCanvas(getWidth(), getHeight())
                    .parent(wrapper);

                canvas = p5Canvas.elt;

                this.sketchProps.setup?.(p5);
            };

            let hasDrawn = false;
            p5.draw = () => {
                if (!hasDrawn) {
                    p5.resizeCanvas(getWidth(), getHeight());
                    hasDrawn = true;
                }
                return this.sketchProps.draw?.(p5);
            };

            /**
             * Environment events
             */

            p5.windowResized = (event: Event) => {
                if (!wrapperRef.current) return;

                console.log({
                    lastSeenSize,
                    width: getWidth(),
                    height: getHeight(),
                });

                if (
                    lastSeenSize.width !== getWidth() ||
                    lastSeenSize.height !== getHeight()
                ) {
                    lastSeenSize.width = getWidth();
                    lastSeenSize.height = getHeight();
                    p5.resizeCanvas(getWidth(), getHeight());
                }

                return this.sketchProps.windowResized?.(p5, event);
            };

            /**
             * Acceleration events
             */
            P5AccelerationEvents.forEach((eventName) => {
                const eventHandler = this.sketchProps[eventName];
                if (eventHandler) {
                    p5[eventName] = () => eventHandler(p5);
                }
            });

            /**
             * Keyboard events
             */
            P5KeyboardEvents.forEach((eventName) => {
                const eventHandler = this.sketchProps[eventName];
                if (eventHandler) {
                    p5[eventName] = (event: KeyboardEvent) =>
                        eventHandler(p5, event);
                }
            });

            /**
             * Mouse events
             */
            P5MouseEvents.forEach((eventName) => {
                const eventHandler = this.sketchProps[eventName];
                if (eventHandler) {
                    p5[eventName] = (event: MouseEvent) => {
                        if (event.target === canvas) {
                            eventHandler(p5, event);
                        }
                    };
                }
            });

            /**
             * Touch events
             */
            P5TouchEvents.forEach((eventName) => {
                const eventHandler = this.sketchProps[eventName];
                if (eventHandler) {
                    p5[eventName] = (event: TouchEvent) => {
                        if (event.target === canvas) {
                            eventHandler(p5, event);
                        }
                    };
                }
            });
        };
    }
}
