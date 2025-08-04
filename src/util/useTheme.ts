import type { NS, UserInterfaceTheme } from 'netscript';

import { useNsUpdate } from 'util/useNsUpdate';

/**
 * Keep a UserInterfaceTheme updated by polling `ns.ui.getTheme()`.
 *
 * @param ns - Netscript API instance
 * @param interval - Milliseconds between theme refreshes
 * @returns The current theme from the UI
 */
export function useTheme(ns: NS, interval = 200): UserInterfaceTheme {
    return useNsUpdate(ns, interval, getTheme);
}

function getTheme(ns: NS): UserInterfaceTheme {
    return ns.ui.getTheme();
}
