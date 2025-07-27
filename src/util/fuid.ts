import { NS } from 'netscript';

/**
 * Create a FUID (fairly unique identifier)
 *
 * FUIDs have 3 components, the pid of the current process, the time
 * in milliseconds since the epoch start (Jan. 1st, 1970), and a 6
 * digit random number.
 *
 * @param ns - Netscript API instance
 * @returns A string representation of the FUID
 */
export function makeFuid(ns: NS) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}
