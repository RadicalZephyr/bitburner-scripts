import type { NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

export async function main(ns: NS) {
    const flags = ns.flags([['all', false], ['help', false], ...MEM_TAG_FLAGS]);
    if (flags.help || typeof flags.all != 'boolean') {
        ns.tprint(`USAGE: run ${ns.getScriptName()} [-all] PORT_NUM...

This script clears the ports specified by PORT_NUMs or all ports up to
PORT_NUM.

OPTIONS
 --all    Clear all port numbers from 0 up until 99,999 or the first specified port number
 --help   Displays this help message
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const rest: string[] = flags._ as string[];
    let maxPort = 99999;
    for (const arg of rest) {
        const portNum = Number(arg);
        if (!Number.isNaN(portNum)) {
            ns.clearPort(portNum);
            if (maxPort < portNum) {
                maxPort = portNum;
            }
        }
    }

    if (flags.all) {
        for (let i = 1; i <= maxPort; i++) {
            ns.clearPort(i);
            if (i % 500 === 0) {
                await ns.sleep(0);
            }
        }
    }

    const finishedMsg = 'finished clearing all ports';
    ns.toast(finishedMsg);
    ns.tprint(finishedMsg);
}
