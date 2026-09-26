/**
 * Whether two age orders list the same positions in the same order.
 */
export function sameOrder(a: readonly number[], b: readonly number[]) {
    return a.length === b.length && a.every((position, i) => position === b[i]);
}
