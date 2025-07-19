import type { NS, ScriptArg } from "netscript";

import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);

    const args = flags._ as ScriptArg[];

    const target = args[0];
    if (typeof target != 'string') {
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 1;
    }

    let donePortId = args[2];

    ns.atExit(() => {
        if (typeof donePortId === 'number' && donePortId !== -1) {
            ns.writePort(donePortId, ns.pid);
        }
    });

    await ns.weaken(target, { additionalMsec: sleepTime });
}
