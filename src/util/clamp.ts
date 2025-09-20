/**
 * Clamp a value between a lower and upper bound
 *
 * @param x - Variable value to clamp
 * @param lowerBound - lower bound
 * @param upperBound - upper bound
 * @returns Clamped value of x
 */
export function clamp(
    x: number,
    lowerBound: number,
    upperBound: number,
): number {
    const [lower, upper] = [lowerBound, upperBound].sort((a, b) => a - b);
    return Math.min(upper, Math.max(lower, x));
}
