import type { NS, UserInterfaceTheme } from 'netscript';
import { parseFlags } from 'util/flags';

import {
    PORT_ALLOCATOR_PORT,
    PORT_ALLOCATOR_RESPONSE_PORT,
    MessageType,
    PortAllocatorProtocol,
    PortAllocatorProtocolDef,
} from 'services/client/port';
import { MemoryClient } from 'services/client/memory';

import {} from 'lib/react';

import { LogRoot } from 'ui/LogRoot';

import { usePoll, useNsUpdate, useTheme } from 'util/hooks';
import { installLogger } from 'util/logger';
import { BaseServer, type Handlers } from 'util/protocol';
import { RingBuffer } from 'util/ring-buffer';

/**
 * Main loop for the PortAllocator daemon.
 */
export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.setTailTitle('Port Allocator');

    const { ns: logNS, buffer } = installLogger(ns, { bufferCap: 100 });

    await startAllocator(logNS, buffer);
}

async function startAllocator(ns: NS, buffer: RingBuffer<string>) {
    const allocator = new PortAllocator(ns);

    const memClient = new MemoryClient(ns);

    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    ns.printRaw(
        <LogRoot ns={ns} buffer={buffer}>
            <PortDisplay ns={ns} allocator={allocator} />
        </LogRoot>,
    );

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

interface PortDisplayProps {
    ns: NS;
    allocator: PortAllocator;
}

function PortDisplay({ ns, allocator }: PortDisplayProps) {
    const theme = useTheme(ns);
    const nextPort = usePoll(ns, 200, () => allocator.nextPort);
    const ports = useNsUpdate(ns, 200, (ns) =>
        Array.from(allocator.allocated).map((p) => ({
            id: p,
            empty: ns.getPortHandle(p).empty(),
            full: ns.getPortHandle(p).full(),
        })),
    );
    return (
        <div>
            <div>Next port: {nextPort}</div>
            {ports.map((p) => (
                <div key={p.id}>
                    {p.id}{' '}
                    <span style={{ color: color(theme, p) }}>{icon(p)}</span>
                </div>
            ))}
        </div>
    );
}

function color(
    theme: UserInterfaceTheme,
    p: { empty: boolean; full: boolean },
): string {
    return p.empty ? theme.success : !p.full ? theme.money : theme.error;
}

function icon(p: { empty: boolean; full: boolean }): string {
    return p.empty ? '✓' : !p.full ? '⚬' : '✗';
}
