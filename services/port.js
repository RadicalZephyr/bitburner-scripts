import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { PORT_ALLOCATOR_PORT, PORT_ALLOCATOR_RESPONSE_PORT, MessageType, } from "services/client/port";
import { MemoryClient } from "services/client/memory";
import { readAllFromPort } from "util/ports";
/**
 * Main loop for the PortAllocator daemon.
 */
export async function main(ns) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    ns.disableLog("sleep");
    const port = ns.getPortHandle(PORT_ALLOCATOR_PORT);
    const respPort = ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT);
    const allocator = new PortAllocator(ns);
    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);
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
async function readRequests(ns, port, respPort, allocator) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next;
        const requestId = msg[1];
        let payload;
        switch (msg[0]) {
            case MessageType.PortRequest:
                payload = allocator.allocate();
                break;
            case MessageType.PortRelease:
                const rel = msg[2];
                allocator.release(rel.port);
                continue;
        }
        while (!respPort.tryWrite([requestId, payload])) {
            await ns.sleep(20);
        }
    }
}
class PortAllocator {
    ns;
    allocated = new Set();
    nextPort = 101;
    constructor(ns) {
        this.ns = ns;
    }
    allocate() {
        while (this.allocated.has(this.nextPort)) {
            this.nextPort += 1;
        }
        const id = this.nextPort;
        this.allocated.add(id);
        this.nextPort += 1;
        return id;
    }
    release(id) {
        if (id <= 100)
            return;
        this.allocated.delete(id);
        this.ns.clearPort(id);
    }
}
