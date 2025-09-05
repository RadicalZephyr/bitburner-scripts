import type { NS, NetscriptPort } from 'netscript';

export const EMPTY_SENTINEL: string = 'NULL PORT DATA';
export const DONE_SENTINEL: string = 'PORT CLOSED';

/**
 * Read all messages available on a port,
 *
 * @param ns   - Netscript API object
 * @param port - NetscriptPort to wait to read from
 * @yields Messages read from the given port
 */
export function* readAllFromPort(ns: NS, port: NetscriptPort) {
    while (true) {
        const nextMsg = port.read();
        if (
            typeof nextMsg === 'string'
            && (nextMsg === EMPTY_SENTINEL || nextMsg === DONE_SENTINEL)
        ) {
            return;
        }
        yield nextMsg;
    }
}
