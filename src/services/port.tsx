import type { NS, NetscriptPort } from "netscript";

import {
    PORT_ALLOCATOR_PORT,
    PORT_ALLOCATOR_RESPONSE_PORT,
    Message,
    MessageType,
    PortRelease,
} from "services/client/port";

import { readAllFromPort } from "util/ports";

/**
 * Main loop for the PortAllocator daemon.
 */
export async function main(ns: NS) {
    ns.disableLog("sleep");

    const port = ns.getPortHandle(PORT_ALLOCATOR_PORT);
    const respPort = ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT);

    const allocator = new PortAllocator(ns);

    let waiting = true;
    port.nextWrite().then(() => { waiting = true; });

    while (true) {
        if (waiting) {
            waiting = false;
            port.nextWrite().then(() => { waiting = true; });
            await readRequests(ns, port, respPort, allocator);
        }
        await ns.sleep(50);
    }
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    allocator: PortAllocator,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1] as string;

        let payload: any;
        switch (msg[0]) {
            case MessageType.PortRequest:
                payload = allocator.allocate();
                break;
            case MessageType.PortRelease:
                const rel = msg[2] as PortRelease;
                allocator.release(rel.port);
                continue;
        }
        while (!respPort.tryWrite([requestId, payload])) {
            await ns.sleep(20);
        }
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
        return id;
    }

    release(id: number) {
        if (id <= 100) return;
        this.allocated.delete(id);
        this.ns.clearPort(id);
    }
}
