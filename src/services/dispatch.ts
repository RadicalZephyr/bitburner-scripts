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
    callNsFn,
} from 'services/client/dispatch';

import { makeFuid } from 'util/fuid';
import { EMPTY_SENTINEL } from 'util/ports';

import { CONFIG } from 'services/config';
import {
    isRequestUnknown,
    ResponseErrUnknown,
    ResponseOkEnvelope,
} from 'util/protocol';

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
                { spawnDelay: 1, ...executorOptions },
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

    if (!isRequestUnknown(peeked)) {
        port.read();
        return LoopAction.Continue;
    }

    if (!DispatchProtocol.isRequest(peeked)) {
        port.read();
        const errorMsg = `ERROR: received unknown message type: '${peeked.type}' with payload: ${JSON.stringify(peeked.payload)}`;
        ns.print(errorMsg);
        const response = {
            id: peeked.id,
            type: peeked.type,
            ok: false,
            error: new Error(errorMsg, { cause: peeked }),
        } satisfies ResponseErrUnknown;
        // Send response
        while (!resp.tryWrite(response)) {
            await ns.sleep(20);
        }
        return LoopAction.Continue;
    }

    const payload = peeked.payload;

    const ramDecision = canExecuteNextFn(ns, payload, calledNsFns);
    if (ramDecision === DispatchResult.RamReset) {
        return LoopAction.RamReset; // don't consume; tell caller to respawn
    }

    if (ramDecision === DispatchResult.RamLimitExceeded) {
        port.read();
        const envelope = {
            id: peeked.id,
            type: peeked.type,
            ok: true,
            payload: {
                ok: false,
                error: new Error(
                    `Requested function exceeds max configured NS fn RAM ${ns.format.ram(CONFIG.maxNsFnRam)}`,
                ),
            },
        } satisfies ResponseOkEnvelope<unknown, DispatchResponse>;
        while (!resp.tryWrite(envelope)) {
            await ns.sleep(20);
        }
        return LoopAction.Continue;
    }

    // Safe to run → do it, then consume and reply
    const response = await handleMessage(ns, payload);
    port.read();

    const envelope = {
        id: peeked.id,
        type: peeked.type,
        ok: true,
        payload: response,
    } satisfies ResponseOkEnvelope<unknown, DispatchResponse>;
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
        const value = await callNsFn(ns, req.method, req.args);
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
            `Requested function exceeds max configured NS fn RAM ${ns.format.ram(CONFIG.maxNsFnRam)}`,
        );
        return DispatchResult.RamLimitExceeded;
    }

    if (!calledNsFns.has(method)) {
        const self = ns.self();
        const currentDynRam = Math.max(self.ramUsage, self.dynamicRamUsage);
        const nextDynRam = currentDynRam + nextFnRam;

        if (CONFIG.maxNsFnRam < nextDynRam) {
            ns.print(
                `WARN: next call to ns.${method}() would push dynamic RAM from ${ns.format.ram(currentDynRam)} to ${ns.format.ram(nextDynRam)} which exceeds ${ns.format.ram(CONFIG.maxNsFnRam)}.`,
            );
            return DispatchResult.RamReset;
        }

        ns.ramOverride(nextDynRam);
        calledNsFns.add(method);
    }

    return DispatchResult.RunFunction;
}
