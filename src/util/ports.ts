import type { NetscriptPort } from '@ns';

export const EMPTY_SENTINEL: string = 'NULL PORT DATA';

/**
 * Read all messages available on a port,
 *
 * @param ns   - Netscript API object
 * @param port - NetscriptPort to wait to read from
 * @yields Messages read from the given port
 */
export function* readAllFromPort(port: NetscriptPort) {
    while (true) {
        const nextMsg = port.read();
        if (typeof nextMsg === 'string' && nextMsg === EMPTY_SENTINEL) {
            return;
        }
        yield nextMsg;
    }
}
