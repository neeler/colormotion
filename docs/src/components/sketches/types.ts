import type p5 from 'p5';

export type P5FunctionDefinition = (p5: p5) => void;
export type P5EnvironmentEventDefinition = (p5: p5, event: Event) => void;
export type P5KeyboardEventDefinition = (p5: p5, event: KeyboardEvent) => void;
export type P5MouseEventDefinition = (p5: p5, event: MouseEvent) => void;
export type P5TouchEventDefinition = (p5: p5, event: TouchEvent) => void;
export type P5AccelerationEventDefinition = (p5: p5) => void;

export const P5CoreFunctions = ['preload', 'setup', 'draw'] as const;
export const P5EnvironmentEvents = ['windowResized'] as const;
export const P5AccelerationEvents = [
    'deviceMoved',
    'deviceShaken',
    'deviceTurned',
] as const;
export const P5KeyboardEvents = [
    'keyPressed',
    'keyReleased',
    'keyTyped',
] as const;
export const P5MouseEvents = [
    'doubleClicked',
    'mouseClicked',
    'mouseDragged',
    'mouseMoved',
    'mousePressed',
    'mouseReleased',
    'mouseWheel',
] as const;
export const P5TouchEvents = [
    'touchEnded',
    'touchMoved',
    'touchStarted',
] as const;

export type SketchProps = {
    /**
     * Core functions
     */
    preload?: P5FunctionDefinition;
    setup?: P5FunctionDefinition;
    draw?: P5FunctionDefinition;

    /**
     * Environment events
     */
    windowResized?: P5EnvironmentEventDefinition;

    /**
     * Acceleration events
     */
    deviceMoved?: P5AccelerationEventDefinition;
    deviceShaken?: P5AccelerationEventDefinition;
    deviceTurned?: P5AccelerationEventDefinition;

    /**
     * Keyboard events
     */
    keyPressed?: P5KeyboardEventDefinition;
    keyReleased?: P5KeyboardEventDefinition;
    keyTyped?: P5KeyboardEventDefinition;

    /**
     * Mouse events
     */
    doubleClicked?: P5MouseEventDefinition;
    mouseClicked?: P5MouseEventDefinition;
    mouseDragged?: P5MouseEventDefinition;
    mouseMoved?: P5MouseEventDefinition;
    mousePressed?: P5MouseEventDefinition;
    mouseReleased?: P5MouseEventDefinition;
    mouseWheel?: P5MouseEventDefinition;

    /**
     * Touch events
     */
    touchEnded?: P5TouchEventDefinition;
    touchMoved?: P5TouchEventDefinition;
    touchStarted?: P5TouchEventDefinition;
};

export type SketchDefinition = (p5: p5) => void;
