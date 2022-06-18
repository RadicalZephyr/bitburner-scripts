/** @param {NS} ns */
export async function main(ns) {
    const growPercents = [
        1.0, 1.05, 1.10, 1.15, 1.25, 1.50, 1.75,
        2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
        9.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0,
        24.0, 28.0, 32.0, 36.0, 40.0, 48.0, 56.0,
        64.0, 72.0, 80.0, 88.0, 96.0,
    ];
    for (const growPercent of growPercents) {
        const secGrowth = securityGrowth(ns, growPercent);
        ns.printf('%s, %s', growPercent, secGrowth);
    }
    ns.printf('security level %s', ns.getServerSecurityLevel("iron-gym").toFixed(2));
    ns.tail();
}
function securityGrowth(ns, factor) {
    const growThreads = Math.ceil(ns.growthAnalyze("iron-gym", factor));
    return (ns.growthAnalyzeSecurity(growThreads)).toFixed(2);
}
