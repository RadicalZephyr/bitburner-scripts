import type { NS, NetscriptPort } from 'netscript';
import { parseFlags } from 'util/flags';

import {
    DISPATCH_PORT,
    DISPATH_RESPONSE_PORT,
    Message,
    MessageType,
    DaemonRequest,
    DaemonResponse,
} from 'services/client/dispatch';
import { MemoryClient } from 'services/client/memory';

import { readAllFromPort, readLoop } from 'util/ports';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const port = ns.getPortHandle(DISPATCH_PORT);
    const respPort = ns.getPortHandle(DISPATH_RESPONSE_PORT);

    await readLoop(ns, port, () => readRequests(ns, port, respPort));
}

async function readRequests(ns: NS, port: NetscriptPort, resp: NetscriptPort) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1];
        if (msg[0] !== MessageType.Dispatch) continue;
        const payload = msg[2];

        let response: DaemonResponse;
        if (!isValidRequest(payload)) {
            response = { ok: false, error: 'Invalid request' };
        } else {
            try {
                const value = await dispatch(ns, payload);
                response = { ok: true, value };
            } catch (err) {
                response = {
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                };
            }
        }

        while (!resp.tryWrite([requestId, response])) {
            await ns.sleep(20);
        }
    }
}

function isValidRequest(req: DaemonRequest): boolean {
    return req && typeof req.method === 'string' && Array.isArray(req.args);
}

async function dispatch(ns: NS, req: DaemonRequest): Promise<unknown> {
    const parts = req.method.split('.');
    let ctx: unknown = ns;
    for (let i = 0; i < parts.length - 1; i++) {
        if (ctx === undefined || ctx === null)
            throw new Error(
                `Unknown namespace: ${parts.slice(0, i + 1).join('.')}`,
            );
        ctx = (ctx as Record<string, unknown>)[parts[i]];
    }
    const fnName = parts[parts.length - 1];
    const fn = (ctx as Record<string, unknown>)[fnName];
    if (typeof fn !== 'function') {
        throw new Error(`NS method ${req.method} not found`);
    }
    return await (fn as (...args: unknown[]) => unknown).apply(ctx, req.args);
}
