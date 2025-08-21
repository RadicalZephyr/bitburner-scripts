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
import { MemoryClient, parseAndRegisterAlloc } from 'services/client/memory';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';

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
    const flags = await parseFlags(ns, FLAGS, false);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [--]

Run arbitrary Netscript functions in an ephemeral process.

OPTIONS
  --${EXECUTOR_OPT}  Run as the ephemeral function executor
  --help      Show this help message

CONFIGURATION
  SERVICE_maxDispatchQueueSize  Maximum number of pending dispatch requests
  SERVICE_maxNsFnRam            Configured maximum RAM for the NS dispatch executor
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
            ...ns.args,
        );
        return;
    }

    ns.ui.setTailTitle(`Dispatch Message Receiver - ${ns.self().server}`);

    await parseAndRegisterAlloc(ns, flags, true);

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
    const alloc = await memClient.requestTransferableAllocation(
        selfRam + CONFIG.maxNsFnRam,
        1,
        { longRunning: true },
    );

    if (
        !alloc
        || alloc.allocatedChunks.length < 1
        || alloc.allocatedChunks[0].numChunks < 1
    )
        throw new Error('Failed to allocate memory for dispatch executor.');

    alloc.releaseAtExit(ns);

    const hostname = alloc.allocatedChunks[0].hostname;

    const script = selfScript.filename;
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];

    if (!ns.scp(files, hostname, 'home'))
        throw new Error('Failed to scp files for executor');

    const pid = ns.exec(
        script,
        hostname,
        executorOptions,
        `--${EXECUTOR_OPT}`,
        ALLOC_ID_ARG,
        alloc.allocationId,
    );

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
                const value = await queueNsCommand(ns, payload);
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

function queueNsCommand(ns: NS, request: DaemonRequest): Promise<unknown> {
    if (pending.length >= CONFIG.maxDispatchQueueSize) {
        ns.print('WARN: Dispatch queue full. Rejecting request.');
        return Promise.reject(new Error('Dispatch queue full'));
    }

    return new Promise((resolve, reject) => {
        pending.push({ request, resolve, reject });
        signalNext();
    });
}

async function executeNextFn(ns: NS) {
    ns.print('INFO: waiting for next function to execute');
    await isPending;

    while (pending.length > 0) {
        const method = pending[0].request.method.trim();
        const nextFnRam = ns.getFunctionRamCost(method);

        ns.print(
            `Got request to call ns.${method}() for ${ns.formatRam(nextFnRam)}`,
        );

        // Check if the next function exceeds maximum RAM usage
        if (CONFIG.maxNsFnRam < nextFnRam) {
            ns.print(
                `Requested function exceeds max configured NS fn RAM ${ns.formatRam(CONFIG.maxNsFnRam)}`,
            );
            const { reject } = pending.shift();
            reject(new Error(ramCostTooLargeMsg(ns, method, nextFnRam)));
            continue;
        }

        const nextDynamicRam = ns.self().dynamicRamUsage + nextFnRam;
        if (CONFIG.maxNsFnRam < nextDynamicRam) {
            ns.print(
                `WARN: next call to ns.${method}() for ${ns.formatRam(nextFnRam)} would exceed dynamic RAM usage maximum of ${ns.formatRam(CONFIG.maxNsFnRam)}`,
            );
            // Running next pending call would exceed RAM allotment,
            // need to restart the dispatch executor to reset dynamic
            // RAM usage to zero.
            return;
        }

        const { request, resolve, reject } = pending.shift();

        try {
            const result = await dispatch(ns, request);
            ns.print(`received result: ${result}`);
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
    if (CONFIG.maxNsFnRam < ramCost)
        throw new Error(ramCostTooLargeMsg(ns, method, ramCost));

    const selfProcess = ns.self();
    const currentRegularRam = selfProcess.ramUsage;
    const currentDynRam = selfProcess.dynamicRamUsage;
    ns.ramOverride(Math.max(currentRegularRam, currentDynRam) + ramCost);

    const parts = method.split('.');
    if (parts.length === 0) throw new Error('Malformed method path');

    let ctx: unknown = ns;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (ctx == null || !Object.hasOwn(ctx as object, seg)) {
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

    const args = req.args.map((a) => JSON.stringify(a)).join(', ');
    try {
        ns.print(`calling ns.${method}(${args})`);
        return await (candidate as (...a: unknown[]) => unknown).apply(
            ctx,
            req.args,
        );
    } catch (e) {
        const msg = e?.message ?? String(e);
        throw new Error(`${method}(${args}) failed: ${msg}`);
    }
}

function ramCostTooLargeMsg(ns: NS, method: string, ramCost: number) {
    return `NS function 'ns.${method}' has a RAM cost of ${ns.formatRam(ramCost)} which is more than the configured maximum RAM cost of ${ns.formatRam(CONFIG.maxNsFnRam)}`;
}
