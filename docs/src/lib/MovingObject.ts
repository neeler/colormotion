import { MovingThing } from '~/lib/MovingThing';

export class MovingObject<T extends object> {
    private readonly properties: { [K in keyof T]: MovingThing<T[K]> };
    private readonly keys: (keyof T)[];

    constructor(properties: { [K in keyof T]: MovingThing<T[K]> }) {
        this.properties = properties;
        this.keys = Object.keys(properties) as (keyof T)[];
    }

    get() {
        return this.keys.reduce((movingObject, key) => {
            movingObject[key] = this.properties[key].get();
            return movingObject;
        }, {} as T);
    }

    tick() {
        this.keys.forEach((key) => this.properties[key].tick());
    }
}
