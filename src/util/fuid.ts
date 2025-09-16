import type { NS } from '@ns';

/**
 * Create a FUID (fairly unique identifier)
 *
 * FUIDs have 3 components, the pid of the current process, the time
 * in milliseconds since the epoch start (Jan. 1st, 1970), and a 6
 * digit random number.
 *
 * @param {NS} ns - Netscript API instance
 * @returns {string} A string representation of the FUID
 */
export function makeFuid(ns: NS): string {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}
