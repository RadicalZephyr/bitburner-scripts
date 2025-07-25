import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { StreamSink, Transaction } from 'sodium';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('ALL');

    if (!ns.gang.inGang()) {
        ns.print(`WARN: Not in a gang! You should probably start one.`);
        return;
    }

    const { sTick } = setup();

    while (true) {
        sTick.send(null);
        await ns.gang.nextUpdate();
    }
}

interface GangSystem {
    sTick: StreamSink<void>;
}

function setup(): GangSystem {
    return Transaction.run(() => {
        const sTick: StreamSink<void> = new StreamSink();
        return { sTick };
    });
}
