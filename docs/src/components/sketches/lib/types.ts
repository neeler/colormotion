import type p5 from 'p5';
import { MovingObject } from '~/lib/MovingObject';

export type SketchData<TState, TMovingState extends object> = {
    state: TState;
    movingState: TMovingState;
};

export type P5FunctionDefinition<TState, TMovingState extends object> = (
    p5: p5,
    data: SketchData<TState, TMovingState>,
) => void;
export type P5EnvironmentEventDefinition<
    TState,
    TMovingState extends object,
> = (p5: p5, data: SketchData<TState, TMovingState>, event: Event) => void;
export type P5KeyboardEventDefinition<TState, TMovingState extends object> = (
    p5: p5,

    data: SketchData<TState, TMovingState>,
    event: KeyboardEvent,
) => void;
export type P5MouseEventDefinition<TState, TMovingState extends object> = (
    p5: p5,

    data: SketchData<TState, TMovingState>,
    event: MouseEvent,
) => void;
export type P5TouchEventDefinition<TState, TMovingState extends object> = (
    p5: p5,

    data: SketchData<TState, TMovingState>,
    event: TouchEvent,
) => void;
export type P5AccelerationEventDefinition<
    TState,
    TMovingState extends object,
> = (p5: p5, data: SketchData<TState, TMovingState>) => void;

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

export type SketchProps<TState = any, TMovingState extends object = any> = {
    /**
     * Internals
     */
    state: () => TState;
    movingState: () => MovingObject<TMovingState>;

    /**
     * Core functions
     */
    preload?: P5FunctionDefinition<TState, TMovingState>;
    setup?: P5FunctionDefinition<TState, TMovingState>;
    draw?: P5FunctionDefinition<TState, TMovingState>;

    /**
     * Environment events
     */
    windowResized?: P5EnvironmentEventDefinition<TState, TMovingState>;

    /**
     * Acceleration events
     */
    deviceMoved?: P5AccelerationEventDefinition<TState, TMovingState>;
    deviceShaken?: P5AccelerationEventDefinition<TState, TMovingState>;
    deviceTurned?: P5AccelerationEventDefinition<TState, TMovingState>;

    /**
     * Keyboard events
     */
    keyPressed?: P5KeyboardEventDefinition<TState, TMovingState>;
    keyReleased?: P5KeyboardEventDefinition<TState, TMovingState>;
    keyTyped?: P5KeyboardEventDefinition<TState, TMovingState>;

    /**
     * Mouse events
     */
    doubleClicked?: P5MouseEventDefinition<TState, TMovingState>;
    mouseClicked?: P5MouseEventDefinition<TState, TMovingState>;
    mouseDragged?: P5MouseEventDefinition<TState, TMovingState>;
    mouseMoved?: P5MouseEventDefinition<TState, TMovingState>;
    mousePressed?: P5MouseEventDefinition<TState, TMovingState>;
    mouseReleased?: P5MouseEventDefinition<TState, TMovingState>;
    mouseWheel?: P5MouseEventDefinition<TState, TMovingState>;

    /**
     * Touch events
     */
    touchEnded?: P5TouchEventDefinition<TState, TMovingState>;
    touchMoved?: P5TouchEventDefinition<TState, TMovingState>;
    touchStarted?: P5TouchEventDefinition<TState, TMovingState>;
};

export type SketchDefinition = (p5: p5) => void;
