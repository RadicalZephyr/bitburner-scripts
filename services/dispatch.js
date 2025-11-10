import { parseFlags } from 'util/flags';
import { DISPATCH_PORT, DISPATCH_RESPONSE_PORT, DispatchProtocol, callNsFn, } from 'services/client/dispatch';
import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';
import { EMPTY_SENTINEL } from 'util/ports';
import { isRequestUnknown, } from 'util/protocol';
import { CONFIG } from 'services/config';
const FLAGS = [['help', false]];
const executorOptions = {
    threads: 1,
    preventDuplicates: true,
    temporary: true,
};
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
function extendNs(ns) {
    return withPlugins(ns, alivePlugin());
}
export async function main(ns) {
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
    await runLoop(extendNs(ns));
}
var ResetAction;
(function (ResetAction) {
    ResetAction["Ok"] = "ok";
    ResetAction["RamReset"] = "ram-reset";
})(ResetAction || (ResetAction = {}));
async function runLoop(ns) {
    const requestPort = ns.getPortHandle(DISPATCH_PORT);
    const responsePort = ns.getPortHandle(DISPATCH_RESPONSE_PORT);
    const calledNsFns = new Set();
    let next;
    while (ns.alive.isAlive()) {
        next = requestPort.nextWrite();
        // Drain all currently queued work
        const result = await drainQueue(ns, requestPort, responsePort, calledNsFns);
        if (result === ResetAction.RamReset) {
            ns.print('INFO: restarting dispatcher to reset dynamic RAM cost');
            ns.spawn(ns.self().filename, { spawnDelay: 1, ...executorOptions }, ...ns.args);
            return;
        }
        // Block until something new arrives
        await next;
    }
}
var LoopAction;
(function (LoopAction) {
    // handled a message, keep draining
    LoopAction["Continue"] = "Continue";
    // queue is empty for now
    LoopAction["Idle"] = "Idle";
    // dynamic RAM would exceed configured cap; caller should respawn
    LoopAction["RamReset"] = "RamReset";
})(LoopAction || (LoopAction = {}));
var DispatchResult;
(function (DispatchResult) {
    DispatchResult["RunFunction"] = "RunFunction";
    DispatchResult["RamReset"] = "RamReset";
    DispatchResult["RamLimitExceeded"] = "RamLimitExceeded";
})(DispatchResult || (DispatchResult = {}));
async function drainQueue(ns, port, resp, calledNsFns) {
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
async function pumpOnce(ns, port, resp, calledNsFns) {
    const peeked = port.peek();
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
        if (typeof peeked.id === 'string') {
            const response = {
                id: peeked.id,
                type: peeked.type,
                ok: false,
                error: new Error(errorMsg, { cause: peeked }),
            };
            // Send response
            while (!resp.tryWrite(response)) {
                await ns.sleep(20);
            }
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
        if (typeof peeked.id === 'string') {
            const envelope = {
                id: peeked.id,
                type: peeked.type,
                ok: true,
                payload: {
                    ok: false,
                    error: new Error(`Requested function exceeds max configured NS fn RAM ${ns.formatRam(CONFIG.maxNsFnRam)}`),
                },
            };
            while (!resp.tryWrite(envelope)) {
                await ns.sleep(20);
            }
        }
        return LoopAction.Continue;
    }
    // Safe to run → do it, then consume and reply
    const response = await handleMessage(ns, payload);
    port.read();
    if (typeof peeked.id === 'string') {
        const envelope = {
            id: peeked.id,
            type: peeked.type,
            ok: true,
            payload: response,
        };
        while (!resp.tryWrite(envelope)) {
            await ns.sleep(20);
        }
    }
    return LoopAction.Continue;
}
async function handleMessage(ns, req) {
    // This print is an implicit check if the Netscript
    // instance is valid. Since we catch all other usages of
    // NS, the script never dies because of an invalid NS
    // object and that means the read loop never ends.
    ns.print('got a new valid DaemonRequest');
    try {
        // NOTE: this should be safe, I'm not sure why the lint is complaining
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value = await callNsFn(ns, req.method, req.args);
        return { ok: true, value };
    }
    catch (error) {
        return {
            ok: false,
            error: error,
        };
    }
}
function canExecuteNextFn(ns, request, calledNsFns) {
    const method = request.method.trim();
    const nextFnRam = ns.getFunctionRamCost(method);
    // Check if the next function exceeds maximum RAM usage
    if (CONFIG.maxNsFnRam < nextFnRam) {
        ns.print(`Requested function exceeds max configured NS fn RAM ${ns.formatRam(CONFIG.maxNsFnRam)}`);
        return DispatchResult.RamLimitExceeded;
    }
    if (!calledNsFns.has(method)) {
        const self = ns.self();
        const currentDynRam = Math.max(self.ramUsage, self.dynamicRamUsage ?? 0);
        const nextDynRam = currentDynRam + nextFnRam;
        if (CONFIG.maxNsFnRam < nextDynRam) {
            ns.print(`WARN: next call to ns.${method}() would push dynamic RAM from ${ns.formatRam(currentDynRam)} to ${ns.formatRam(nextDynRam)} which exceeds ${ns.formatRam(CONFIG.maxNsFnRam)}.`);
            return DispatchResult.RamReset;
        }
        ns.ramOverride(nextDynRam);
        calledNsFns.add(method);
    }
    return DispatchResult.RunFunction;
}
