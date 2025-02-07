export interface MovingThing<T> {
    get(): T;
    tick(): void;
}
