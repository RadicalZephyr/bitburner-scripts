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

import { makeFuid } from 'util/fuid';
import { EMPTY_SENTINEL } from 'util/ports';

import { CONFIG } from 'services/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

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
  --help      Show this help message

CONFIGURATION
  SERVICE_maxNsFnRam            Configured maximum RAM for the NS dispatch executor
`);
        return;
    }

    ns.disableLog('sleep');
    ns.ui.openTail();
    ns.ui.setTailTitle(`Dispatch Executor - ${ns.self().server}`);

    const port = ns.getPortHandle(DISPATCH_PORT);
    const respPort = ns.getPortHandle(DISPATCH_RESPONSE_PORT);

    let running = true;
    ns.atExit(() => {
        running = false;
    }, makeFuid(ns));

    const calledNsFns: Set<string> = new Set();

    let next = port.nextWrite();
    while (running) {
        try {
            await readRequests(ns, port, respPort, calledNsFns);
        } catch (err) {
            if (err !== DispatchResult.RamReset) {
                const msg = `ERROR: Unexpected error in dispatch executor: ${String(err)}`;
                ns.tprint(msg);
                console.error(msg);
                throw new Error(msg, { cause: err });
            }

            ns.print('INFO: restarting dispatcher to reset RAM cost');
            break;
        }
        await next;
        next = port.nextWrite();
    }

    ns.spawn(
        ns.self().filename,
        { spawnDelay: 0, ...executorOptions },
        ...ns.args,
    );
}

enum DispatchResult {
    RunFunction = 'RunFunction',
    RamReset = 'RamReset',
    RamLimitExceeded = 'RamLimitExceeded',
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    resp: NetscriptPort,
    calledNsFns: Set<string>,
) {
    while (true) {
        const next = port.peek();
        if (typeof next === 'string' && next === EMPTY_SENTINEL) {
            return;
        }

        const msg = next as Message;
        const requestId = msg[1];
        if (msg[0] !== MessageType.Dispatch) {
            port.read();
            continue;
        }
        const payload = msg[2];

        const response = await handleMessage(ns, payload, calledNsFns);
        port.read();

        while (!resp.tryWrite([requestId, response])) {
            await ns.sleep(20);
        }
    }
}

async function handleMessage(
    ns: NS,
    request: unknown,
    calledNsFns: Set<string>,
): Promise<DaemonResponse> {
    if (!isValidRequest(request)) {
        return { ok: false, error: 'Invalid request' };
    }

    // This print is an implicit check if the Netscript
    // instance is valid. Since we catch all other usages of
    // NS, the script never dies because of an invalid NS
    // object and that means the read loop never ends.
    ns.print('got a new valid DaemonRequest');
    const result = canExecuteNextFn(ns, request, calledNsFns);

    if (result !== DispatchResult.RunFunction) {
        throw result;
    }

    try {
        const value = await dispatch(ns, request);
        return { ok: true, value };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

function isValidRequest(req: unknown): req is DaemonRequest {
    return (
        req
        && typeof req === 'object'
        && typeof (req as Record<string, unknown>).method === 'string'
        && Array.isArray((req as Record<string, unknown>).args)
    );
}

function canExecuteNextFn(
    ns: NS,
    request: DaemonRequest,
    calledNsFns: Set<string>,
): DispatchResult {
    const method = request.method.trim();
    const nextFnRam = ns.getFunctionRamCost(method);

    // Check if the next function exceeds maximum RAM usage
    if (CONFIG.maxNsFnRam < nextFnRam) {
        ns.print(
            `Requested function exceeds max configured NS fn RAM ${ns.formatRam(CONFIG.maxNsFnRam)}`,
        );
        return DispatchResult.RamLimitExceeded;
    }

    if (!calledNsFns.has(method)) {
        const self = ns.self();
        const currentDynRam = Math.max(self.ramUsage, self.dynamicRamUsage);
        const nextDynRam = currentDynRam + nextFnRam;

        if (CONFIG.maxNsFnRam < nextDynRam) {
            ns.print(
                `WARN: next call to ns.${method}() would push dynamic RAM from ${ns.formatRam(currentDynRam)} to ${ns.formatRam(nextDynRam)} which exceeds ${ns.formatRam(CONFIG.maxNsFnRam)}.`,
            );
            return DispatchResult.RamReset;
        }

        ns.ramOverride(nextDynRam);
        calledNsFns.add(method);
    }

    return DispatchResult.RunFunction;
}

async function dispatch(ns: NS, req: DaemonRequest): Promise<unknown> {
    const method = req.method.trim();
    if (!method) throw new Error('Empty method name');

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
