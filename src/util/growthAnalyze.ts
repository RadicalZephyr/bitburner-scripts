import { NS } from 'netscript';

/**
 * Calculate the number of threads needed to build the server by a
 * certain multiplier. The result accounts for the player's grow
 * thread multiplier.
 *
 * @param ns           - Netscript API instance
 * @param target       - Target to
 * @param maxMoney     - Maximum possible money for target
 * @param currentMoney - Current money available on target
 * @returns Number of threads needed to grow target back to max money
 */
export function growthAnalyze(
    ns: NS,
    target: string,
    maxMoney: number,
    currentMoney: number,
): number {
    if (currentMoney <= 0 || !Number.isFinite(currentMoney)) return maxMoney;
    const growAmount = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    if (growAmount <= 0 || !Number.isFinite(growAmount)) return 0;

    return Math.ceil(ns.growthAnalyze(target, growAmount, 1));
}
