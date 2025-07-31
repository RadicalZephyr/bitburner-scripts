import type { NS, NetscriptPort } from 'netscript';
import { parseFlags } from 'util/flags';

import {
    Message,
    MessageType,
    SOURCE_FILE_PORT,
    SOURCE_FILE_RESPONSE_PORT,
    RequestLevel,
} from 'services/client/source_file';
import { MemoryClient } from 'services/client/memory';

import { readAllFromPort, readLoop } from 'util/ports';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const port = ns.getPortHandle(SOURCE_FILE_PORT);
    const respPort = ns.getPortHandle(SOURCE_FILE_RESPONSE_PORT);

    const owned = ns.singularity.getOwnedSourceFiles();
    const levels = new Map<number, number>();
    for (const sf of owned) {
        levels.set(sf.n, sf.lvl);
    }

    await readLoop(ns, port, () => readRequests(ns, port, respPort, levels));
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    resp: NetscriptPort,
    levels: Map<number, number>,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1];
        if (typeof requestId !== 'string') continue;
        let payload: number | Record<number, number>;
        switch (msg[0]) {
            case MessageType.RequestLevel: {
                const req = msg[2] as RequestLevel;
                payload = levels.get(req.n) ?? 0;
                break;
            }
            case MessageType.RequestAll:
                payload = Object.fromEntries(levels);
                break;
            default:
                payload = 0;
                break;
        }
        while (!resp.tryWrite([requestId, payload])) {
            await ns.sleep(20);
        }
    }
}
