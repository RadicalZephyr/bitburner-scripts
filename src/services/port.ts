import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import {
    PORT_ALLOCATOR_PORT,
    PORT_ALLOCATOR_RESPONSE_PORT,
    MessageType,
    PortAllocatorProtocol,
    PortAllocatorProtocolDef,
} from 'services/client/port';
import { MemoryClient } from 'services/client/memory';

import { BaseServer, type Handlers } from 'util/protocol';

/**
 * Main loop for the PortAllocator daemon.
 */
export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('sleep');

    const allocator = new PortAllocator(ns);

    const memClient = new MemoryClient(ns);

    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const server = new Server(ns, allocator);
    await server.readLoop();
}

class Server extends BaseServer<PortAllocatorProtocolDef> {
    constructor(ns: NS, allocator: PortAllocator) {
        const requestPort = ns.getPortHandle(PORT_ALLOCATOR_PORT);
        const responsePort = ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT);
        const handlers: Handlers<PortAllocatorProtocolDef> = {
            [MessageType.PortRequest]: () => {
                const port = allocator.allocate();
                ns.print(`SUCCESS: allocated port ${port}`);
                return Promise.resolve(port);
            },
            [MessageType.PortRelease]: (port) => {
                allocator.release(port);
                ns.print(`SUCCESS: released port ${port}`);
                return Promise.resolve();
            },
        };
        super(ns, PortAllocatorProtocol, requestPort, responsePort, handlers);
    }
}

class PortAllocator {
    ns: NS;
    allocated: Set<number> = new Set();
    nextPort: number = 101;

    constructor(ns: NS) {
        this.ns = ns;
    }

    allocate(): number {
        while (this.allocated.has(this.nextPort)) {
            this.nextPort += 1;
        }
        const id = this.nextPort;
        this.allocated.add(id);
        this.nextPort += 1;
        // Clear port before returning to ensure no stale messages exist
        this.ns.clearPort(id);
        return id;
    }

    release(id: number) {
        if (id <= 100) return;
        this.allocated.delete(id);
        this.ns.clearPort(id);
    }
}
