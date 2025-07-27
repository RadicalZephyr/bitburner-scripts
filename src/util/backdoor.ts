import type { NS, Server } from 'netscript';

/**
 * Check whether this server needs a backdoor installed.
 *
 * @param info - Server instance
 * @returns if this server needs a backdoor
 */
export function needsBackdoor(info: Server): boolean {
    return !(
        info.hostname === 'home'
        || info.purchasedByPlayer
        || info.backdoorInstalled
    );
}

/**
 * Check whether it's possible for us to install a backdoor on a server.
 *
 * @param ns   - Netscript API instance
 * @param info - Server instance
 * @returns if we can install a backdoor on the server
 */
export function canInstallBackdoor(ns: NS, info: Server): boolean {
    return (
        ns.getHackingLevel() >= info.requiredHackingSkill && info.hasAdminRights
    );
}
