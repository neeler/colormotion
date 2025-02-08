/**
 * Returns the number n, modulo the modulus. The result is always non-negative.
 */
export function safeMod(n: number, modulus: number) {
    return ((n % modulus) + modulus) % modulus;
}
