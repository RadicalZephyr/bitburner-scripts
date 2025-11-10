import { parseFlags } from 'util/flags';
import { PORT_ALLOCATOR_PORT, PORT_ALLOCATOR_RESPONSE_PORT, MessageType, PortAllocatorProtocol, } from 'services/client/port';
import { MemoryClient } from 'services/client/memory';
import { withPlugins } from 'ns/extend';
import { loggerPlugin } from 'ns/plugins/logger';
import { UI_CONFIG } from 'ui/config';
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'ui/constants';
import { usePoll, useNsUpdate, useTheme } from 'ui/hooks';
import { LogRoot } from 'ui/LogRoot';
import { BaseServer } from 'util/protocol';
import { React } from 'lib/react';
function extendNs(ns) {
    const bufferCap = 500;
    return withPlugins(ns, loggerPlugin(bufferCap));
}
/**
 * Main loop for the PortAllocator daemon.
 */
export async function main(ns) {
    await parseFlags(ns, []);
    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.setTailTitle('Port Allocator');
    if (UI_CONFIG.openHUD) {
        ns.ui.openTail();
        ns.ui.resizeTail(HUD_WIDTH / 4, HUD_HEIGHT);
        const [ww] = ns.ui.windowSize();
        const xPos = Math.max(0, ww - (1.75 * HUD_WIDTH + STATUS_WINDOW_WIDTH));
        ns.ui.moveTail(xPos, 0);
    }
    const nsx = extendNs(ns);
    const buffer = nsx.getLogBuffer();
    await startAllocator(nsx, buffer);
}
async function startAllocator(ns, buffer) {
    const allocator = new PortAllocator(ns);
    const memClient = new MemoryClient(ns);
    const self = ns.self();
    void memClient.registerAllocation(self.server, self.ramUsage, 1);
    ns.printRaw(React.createElement(LogRoot, { ns: ns, buffer: buffer },
        React.createElement(PortDisplay, { ns: ns, allocator: allocator })));
    const server = new Server(ns, allocator);
    await server.readLoop();
}
class Server extends BaseServer {
    constructor(ns, allocator) {
        const requestPort = ns.getPortHandle(PORT_ALLOCATOR_PORT);
        const responsePort = ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT);
        const handlers = {
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
        // Clear port before returning to ensure no stale messages exist
        this.ns.clearPort(id);
        return id;
    }
    release(id) {
        if (id <= 100)
            return;
        this.allocated.delete(id);
        this.ns.clearPort(id);
    }
}
function PortDisplay({ ns, allocator }) {
    const theme = useTheme(ns);
    const nextPort = usePoll(ns, 200, () => allocator.nextPort);
    const ports = useNsUpdate(ns, 200, (ns) => Array.from(allocator.allocated).map((p) => {
        const port = ns.getPortHandle(p);
        return {
            id: p,
            empty: port.empty(),
            full: port.full(),
        };
    }));
    return (React.createElement("div", null,
        React.createElement("div", null,
            "Next port: ",
            nextPort),
        ports.map((p) => (React.createElement("div", { key: p.id },
            p.id,
            ' ',
            React.createElement("span", { style: { color: color(theme, p) } }, icon(p)))))));
}
function color(theme, p) {
    return p.empty ? theme.success : !p.full ? theme.money : theme.error;
}
function icon(p) {
    return p.empty ? '✓' : !p.full ? '⚬' : '✗';
}
