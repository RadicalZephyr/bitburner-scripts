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
import { readAllFromPort } from 'util/ports';

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
            if (err !== DispatchError.RamReset) {
                ns.tprint(
                    `ERROR: Unexpected error in dispatch executor: ${String(err)}`,
                );
                console.error(err);
                return;
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

enum DispatchError {
    RamReset = 'RamReset',
    RamLimitExceeded = 'RamLimitExceeded',
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    resp: NetscriptPort,
    calledNsFns: Set<string>,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1];
        if (msg[0] !== MessageType.Dispatch) continue;
        const payload = msg[2];

        let response: DaemonResponse;
        if (!isValidRequest(payload)) {
            response = { ok: false, error: 'Invalid request' };
        } else {
            // This print is an implicit check if the Netscript
            // instance is valid. Since we catch all other usages of
            // NS, the script never dies because of an invalid NS
            // object and that means the read loop never ends.
            ns.print('got a new valid DaemonRequest');

            try {
                const value = await executeNextFn(ns, payload, calledNsFns);
                response = { ok: true, value };
            } catch (err) {
                if (err.cause != null) {
                    throw err.cause;
                }

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

async function executeNextFn(
    ns: NS,
    request: DaemonRequest,
    calledNsFns: Set<string>,
) {
    ns.print('INFO: waiting for next function to execute');

    const method = request.method.trim();
    const nextFnRam = ns.getFunctionRamCost(method);

    ns.print(
        `Got request to call ns.${method}() for ${ns.formatRam(nextFnRam)}`,
    );

    // Check if the next function exceeds maximum RAM usage
    if (CONFIG.maxNsFnRam < nextFnRam) {
        ns.print(
            `Requested function exceeds max configured NS fn RAM ${ns.formatRam(CONFIG.maxNsFnRam)}`,
        );
        throw new Error(ramCostTooLargeMsg(ns, method, nextFnRam), {
            cause: DispatchError.RamLimitExceeded,
        });
    }

    if (!calledNsFns.has(request.method.trim())) {
        const selfProcess = ns.self();
        const currentDynRam = Math.max(
            selfProcess.ramUsage,
            selfProcess.dynamicRamUsage,
        );
        const nextDynamicRam = currentDynRam + nextFnRam;

        if (CONFIG.maxNsFnRam < nextDynamicRam) {
            ns.print(
                `WARN: next call to ns.${method}() for ${ns.formatRam(nextFnRam)} would exceed dynamic RAM usage maximum of ${ns.formatRam(CONFIG.maxNsFnRam)}`,
            );
            // TODO (ZEFS 2025-08-21): Reading directly from the Port
            // and executing queries means that if we need to restart
            // to reset the RAM counter then we lose the message we
            // already popped from the port. In order to handle this,
            // we need to peek at the messages in the port and then
            // check the ram cost before we decide to either restart
            // to reset the RAM counter or pop it from the port and
            // run it.

            // Running next pending call would exceed RAM allotment,
            // need to restart the dispatch executor to reset dynamic
            // RAM usage to zero.
            throw new Error('Dynamic RAM budget exceeded, need to restart', {
                cause: DispatchError.RamReset,
            });
        }

        ns.ramOverride(currentDynRam + nextFnRam);
        calledNsFns.add(request.method.trim());
    }

    const result = await dispatch(ns, request);

    ns.print(`received result: ${result}`);
    return result;
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

function ramCostTooLargeMsg(ns: NS, method: string, ramCost: number) {
    return `NS function 'ns.${method}' has a RAM cost of ${ns.formatRam(ramCost)} which is more than the configured maximum RAM cost of ${ns.formatRam(CONFIG.maxNsFnRam)}`;
}
