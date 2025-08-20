import type {
    AutocompleteData,
    NS,
    NetscriptPort,
    RunOptions,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    DISPATCH_PORT,
    DISPATCH_RESPONSE_PORT,
    Message,
    MessageType,
    DaemonRequest,
    DaemonResponse,
} from 'services/client/dispatch';
import { MemoryClient } from 'services/client/memory';

import { readAllFromPort, readLoop } from 'util/ports';
import { collectDependencies } from 'util/dependencies';

import { CONFIG } from 'services/config';

const EXECUTOR_OPT = 'executor' as const;

const FLAGS = [
    [EXECUTOR_OPT, false],
    ['help', false],
] as const satisfies FlagsSchema;

const executorOptions: RunOptions = {
    threads: 1,
    preventDuplicates: true,
    temporary: true,
};

export function autocomplete(data: AutocompleteData): readonly string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [--]

Run arbitrary Netscript functions in an ephemeral process.

OPTIONS
  --${EXECUTOR_OPT}  Run as the ephemeral function executor
  --help      Show this help message
`);
        return;
    }

    ns.ui.openTail();

    if (flags.executor) {
        ns.ui.setTailTitle(`Dispatch Executor - ${ns.self().server}`);
        await executeNextFn(ns);
        ns.spawn(
            ns.self().filename,
            { spawnDelay: 0, ...executorOptions },
            `--${EXECUTOR_OPT}`,
        );
        return;
    }

    ns.ui.setTailTitle(`Dispatch Message Receiver - ${ns.self().server}`);

    await startExecutor(ns);

    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const port = ns.getPortHandle(DISPATCH_PORT);
    const respPort = ns.getPortHandle(DISPATCH_RESPONSE_PORT);

    await readLoop(ns, port, () => readRequests(ns, port, respPort));
}

async function startExecutor(ns: NS) {
    const memClient = new MemoryClient(ns);

    const selfScript = ns.self();
    const selfRam = selfScript.ramUsage;
    const alloc = await memClient.requestOwnedAllocation(
        selfRam + CONFIG.maxNsFnRam,
        1,
        { longRunning: true },
    );

    if (!alloc || alloc.length < 1 || alloc[0].numChunks < 1)
        throw new Error('Failed to allocate memory for dispatch executor.');

    const hostname = alloc[0].hostname;

    const script = selfScript.filename;
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];

    if (!ns.scp(files, hostname, 'home'))
        throw new Error('Failed to scp files for executor');

    const pid = ns.exec(script, hostname, executorOptions, `--${EXECUTOR_OPT}`);

    if (pid === 0)
        throw new Error(`Failed to start executor script on ${hostname}`);
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
                const value = await queueNsCommand(payload);
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

interface NsRequest {
    request: DaemonRequest;
    resolve: (response: unknown) => void;
    reject: (reason?: unknown) => void;
}

let isPending: Promise<void> = Promise.resolve();
let signalNext: () => void = () => null;
const pending: NsRequest[] = [];

function queueNsCommand(request: DaemonRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
        pending.push({ request, resolve, reject });
        signalNext.call(null);
    });
}

async function executeNextFn(ns: NS) {
    await isPending;

    if (pending.length > 0) {
        const { request, resolve, reject } = pending.shift();
        try {
            const result = await dispatch(ns, request);
            resolve(result);
        } catch (err) {
            reject(err);
        }
    }

    if (pending.length === 0) {
        isPending = new Promise((res) => {
            signalNext = res;
        });
    }
}

async function dispatch(ns: NS, req: DaemonRequest): Promise<unknown> {
    const method = req.method.trim();
    if (!method) throw new Error('Empty method name');

    const ramCost = ns.getFunctionRamCost(method);
    const currentRam = ns.self().dynamicRamUsage;
    ns.ramOverride(currentRam + ramCost);

    const parts = method.split('.');
    if (parts.length === 0) throw new Error('Malformed method path');

    let ctx: unknown = ns;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (ctx == null || !(seg in (ctx as object))) {
            throw new Error(
                `Unknown namespace: ${parts.slice(0, i + 1).join('.')}`,
            );
        }
        ctx = (ctx as Record<string, unknown>)[seg];
    }

    const fnName = parts[parts.length - 1]!;
    const candidate = (ctx as Record<string, unknown>)?.[fnName];

    if (typeof candidate !== 'function') {
        throw new Error(`NS method not found or not callable: ${method}`);
    }

    try {
        return await (candidate as (...a: unknown[]) => unknown).apply(
            ctx,
            req.args,
        );
    } catch (e) {
        const msg = e?.message ?? String(e);
        const args = req.args.map((a) => JSON.stringify(a)).join(', ');
        throw new Error(`${method}(${args}) failed: ${msg}`);
    }
}
