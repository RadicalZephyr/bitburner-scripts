import type { NS } from '@ns';
import { parseFlags } from 'util/flags';

import { MemoryClient } from 'services/client/memory';
import {
    MessageType,
    SOURCE_FILE_PORT,
    SOURCE_FILE_RESPONSE_PORT,
    SourceFileProtocolDef,
    SourceFileProtocol,
} from 'services/client/source_file';

import { BaseServer, type Handlers } from 'util/protocol';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const owned = ns.singularity.getOwnedSourceFiles();
    const levels = new Map<number, number>();
    for (const sf of owned) {
        levels.set(sf.n, sf.lvl);
    }

    const server = new Server(ns, levels);
    await server.readLoop();
}

class Server extends BaseServer<SourceFileProtocolDef> {
    constructor(ns: NS, levels: Map<number, number>) {
        const requestPort = ns.getPortHandle(SOURCE_FILE_PORT);
        const responsePort = ns.getPortHandle(SOURCE_FILE_RESPONSE_PORT);
        const handlers: Handlers<SourceFileProtocolDef> = {
            [MessageType.RequestLevel]: (req) => {
                return Promise.resolve(levels.get(req.n) ?? 0);
            },
            [MessageType.RequestAll]: () => {
                return Promise.resolve(Object.fromEntries(levels));
            },
        };
        super(ns, SourceFileProtocol, requestPort, responsePort, handlers);
    }
}
