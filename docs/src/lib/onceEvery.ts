/**
 * Returns true once every `n` calls on average.
 */
export function onceEvery(n: number) {
    return Math.floor(Math.random() * n) === 0;
}
