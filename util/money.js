/**
 * Check whether you can currently afford to spend some amount of money.
 *
 * @param ns   - Netscript API instance
 * @param cost - Cost of whatever you want to buy
 * @returns whether you can currently afford to buy it
 */
export function canAfford(ns, cost) {
    return ns.getServerMoneyAvailable('home') >= cost;
}
