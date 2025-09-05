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
    DispatchRequest,
    DispatchResponse,
    DispatchProtocol,
} from 'services/client/dispatch';

import { makeFuid } from 'util/fuid';
import { EMPTY_SENTINEL } from 'util/ports';

import { CONFIG } from 'services/config';
import { isRequestUnknown } from '/util/protocol';

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

    await runLoop(ns);
}

enum ResetAction {
    Ok = 'ok',
    RamReset = 'ram-reset',
}

async function runLoop(ns: NS) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, makeFuid(ns));

    const requestPort = ns.getPortHandle(DISPATCH_PORT);
    const responsePort = ns.getPortHandle(DISPATCH_RESPONSE_PORT);

    const calledNsFns: Set<string> = new Set();

    let next: Promise<void>;
    while (running) {
        next = requestPort.nextWrite();

        // Drain all currently queued work
        const result = await drainQueue(
            ns,
            requestPort,
            responsePort,
            calledNsFns,
        );

        if (result === ResetAction.RamReset) {
            ns.print('INFO: restarting dispatcher to reset dynamic RAM cost');
            ns.spawn(
                ns.self().filename,
                { spawnDelay: 0, ...executorOptions },
                ...ns.args,
            );
            return;
        }

        // Block until something new arrives
        await next;
    }
}

enum LoopAction {
    // handled a message, keep draining
    Continue = 'Continue',

    // queue is empty for now
    Idle = 'Idle',

    // dynamic RAM would exceed configured cap; caller should respawn
    RamReset = 'RamReset',
}

enum DispatchResult {
    RunFunction = 'RunFunction',
    RamReset = 'RamReset',
    RamLimitExceeded = 'RamLimitExceeded',
}

async function drainQueue(
    ns: NS,
    port: NetscriptPort,
    resp: NetscriptPort,
    calledNsFns: Set<string>,
): Promise<ResetAction> {
    let handled = 0;

    while (true) {
        const action = await pumpOnce(ns, port, resp, calledNsFns);

        if (action === LoopAction.Idle) {
            return ResetAction.Ok; // nothing to do right now
        }
        if (action === LoopAction.RamReset) {
            return ResetAction.RamReset;
        }

        // Periodically yield the event loop so UI doesn’t starve.
        if ((++handled & 0xf) === 0) {
            await ns.sleep(0);
        }
    }
}

async function pumpOnce(
    ns: NS,
    port: NetscriptPort,
    resp: NetscriptPort,
    calledNsFns: Set<string>,
): Promise<LoopAction> {
    const peeked = port.peek() as unknown;

    // Empty queue → let caller go idle and await nextWrite()
    if (typeof peeked === 'string' && peeked === EMPTY_SENTINEL) {
        return LoopAction.Idle;
    }

    if (!isRequestUnknown(peeked) || !DispatchProtocol.isRequest(peeked)) {
        port.read();
        return LoopAction.Continue;
    }

    const payload = peeked.payload;

    const ramDecision = canExecuteNextFn(ns, payload, calledNsFns);
    if (ramDecision === DispatchResult.RamReset) {
        return LoopAction.RamReset; // don't consume; tell caller to respawn
    }

    // Safe to run → do it, then consume and reply
    const response = await handleMessage(ns, payload);
    port.read();

    const envelope = {
        type: peeked.type,
        id: peeked.id,
        ok: true,
        payload: response,
    };
    while (!resp.tryWrite(envelope)) {
        await ns.sleep(20);
    }

    return LoopAction.Continue;
}

async function handleMessage(
    ns: NS,
    req: DispatchRequest,
): Promise<DispatchResponse> {
    // This print is an implicit check if the Netscript
    // instance is valid. Since we catch all other usages of
    // NS, the script never dies because of an invalid NS
    // object and that means the read loop never ends.
    ns.print('got a new valid DaemonRequest');

    try {
        const value = await dispatch(ns, req);
        return { ok: true, value };
    } catch (error) {
        return {
            ok: false,
            error,
        };
    }
}

function canExecuteNextFn(
    ns: NS,
    request: DispatchRequest,
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

async function dispatch(ns: NS, req: DispatchRequest): Promise<unknown> {
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
