import type { NS, NetscriptPort } from "netscript";

export const EMPTY_SENTINEL: string = "NULL PORT DATA";
export const DONE_SENTINEL: string = "PORT CLOSED";

/**
 * Read all messages available on a port,
 *
 * @param ns   - Netscript API object
 * @param port - NetscriptPort to wait to read from
 * @yields Messages read from the given port
 */
export function* readAllFromPort(ns: NS, port: NetscriptPort) {
    while (true) {
        let nextMsg = port.read();
        if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === DONE_SENTINEL)) {
            return;
        }
        yield nextMsg;
    }
}

/**
 * Run a continuous loop alternately awaiting next write on a
 * NetscriptPort and reading from the port.
 *
 * N.B. the `readFn` should read from the same port passed to
 * `readLoop`.
 *
 * The Promise returned by this function should not be awaited unless
 * you wish to wait until this script is killed.
 *
 * Any exceptions thrown by `readFn` are logged with a warning and the
 * loop continues.
 *
 * @param ns     - Netscript API object
 * @param port   - NetscriptPort to wait to read from
 * @param readFn - Callback to read from and process port messages
 */
export async function readLoop(ns: NS, port: NetscriptPort, readFn: () => Promise<void>) {
    const scriptInfo = ns.self();
    let running = true;
    ns.atExit(() => {
        running = false;
    }, `${scriptInfo.filename}-${scriptInfo.server}-readLoop`);

    let next = port.nextWrite();
    while (running) {
        try {
            await readFn();
        } catch (err) {
            ns.print(`WARN: failed to read from port ${String(err)}`)
        }
        await next;
        next = port.nextWrite();
    }
}
