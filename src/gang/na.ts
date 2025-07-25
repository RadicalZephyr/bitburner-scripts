import type { GangGenInfo, GangMemberInfo, NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { CellSink, StreamSink, Transaction } from 'sodium';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('ALL');

    if (!ns.gang.inGang()) {
        ns.print(`WARN: Not in a gang! You should probably start one.`);
        return;
    }

    const { sTick, cGangInfo, cMembers } = setup(ns);

    while (true) {
        // Update all cells in a transaction to minimize the number of transactions.
        Transaction.run(() => {
            cGangInfo.send(ns.gang.getGangInformation());
            cMembers.send(memberInfoMap(ns));
        });

        // Send tick in a separate transaction so the cells contain their new values.
        sTick.send(null);
        await ns.gang.nextUpdate();
    }
}

interface GangSystem {
    sTick: StreamSink<void>;
    cGangInfo: CellSink<GangGenInfo>;
    cMembers: CellSink<Map<string, GangMemberInfo>>;
}

function setup(ns: NS): GangSystem {
    return Transaction.run(() => {
        const sTick: StreamSink<void> = new StreamSink();
        const cGangInfo = new CellSink(ns.gang.getGangInformation());
        const cMembers = new CellSink(memberInfoMap(ns));
        return { sTick, cGangInfo, cMembers };
    });
}

function memberInfoMap(ns: NS): Map<string, GangMemberInfo> {
    return new Map(
        ns.gang
            .getMemberNames()
            .map((n) => [n, ns.gang.getMemberInformation(n)]),
    );
}
