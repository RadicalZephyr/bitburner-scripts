import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
    getHighestPurchasableRamLevel,
    reportServerComplementCost,
} from 'util/server';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const percentSpend = ns.args[0] ? ns.args[0] : 1.0;
    if (
        typeof percentSpend !== 'number'
        || percentSpend < 0.0
        || percentSpend > 1.0
    ) {
        ns.tprintf(
            'invalid percentSpend argument %s, please specify a number between 0.0 and 1.0',
            percentSpend,
        );
        return;
    }

    const ram = getHighestPurchasableRamLevel(ns, percentSpend);
    ns.tprintf(
        'by spending %s of your money:\n',
        ns.formatPercent(percentSpend),
    );
    reportServerComplementCost(ns, ram);
    ns.tprintf(
        'Highest possible RAM purchase is %s',
        ns.formatRam(ns.getPurchasedServerMaxRam()),
    );
}
