import type { NS } from "netscript";

export async function main(ns: NS) {
    let target = ns.args[0];
    if (typeof target != 'string') {
        ns.print("Invalid target given: %s", target);
        return;
    }

    let moneyThreshold = ns.getServerMaxMoney(target);
    let securityThreshold = ns.getServerMinSecurityLevel(target);

    while (true) {
        if (ns.getServerSecurityLevel(target) > securityThreshold) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThreshold) {
            await ns.grow(target);
        } else {
            ns.tprintf('%s is ready to hack', target);
            return;
        }
    }
}
