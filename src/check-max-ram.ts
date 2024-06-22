import type { NS } from "netscript";

import { GB, getHighestPurchasableRamLevel, reportServerComplementCost } from './util/server';

export async function main(ns: NS) {
    const percentSpend = ns.args[0] ? ns.args[0] : 1.0;
    if (typeof percentSpend !== 'number' || percentSpend < 0.0 || percentSpend > 1.0) {
        ns.tprintf("invalid percentSpend argument %s, please specify a number between 0.0 and 1.0", percentSpend);
        return;
    }

    const ram = getHighestPurchasableRamLevel(ns, percentSpend);
    ns.tprintf("by spending %s of your money:\n", ns.nFormat(percentSpend, '0%'));
    reportServerComplementCost(ns, ram);
    ns.tprintf("highest possible RAM purchase is %s", ns.nFormat(ns.getPurchasedServerMaxRam() * GB, '0b'));

}
