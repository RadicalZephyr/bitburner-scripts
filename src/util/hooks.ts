import type { NS, UserInterfaceTheme } from 'netscript';

import { makeFuid } from 'util/fuid';

/**
 * Get an updating state value derived from polling the Netscript API
 * with an update function.
 *
 * @param ns       - Netscript API instance
 * @param interval - Milliseconds between polling `updateFn`
 * @param updateFn - Function to poll state from Netscript APIs
 * @returns Reactive state produced by `updateFn`
 */
export function useNsUpdate<T>(
    ns: NS,
    interval: number,
    updateFn: (ns: NS) => T,
): T {
    const [data, setData] = React.useState(updateFn(ns));

    React.useEffect(() => {
        const id = globalThis.setInterval(() => {
            setData(updateFn(ns));
        }, interval);

        const exitHandlerName = 'useNsUpdate-' + makeFuid(ns);

        ns.atExit(() => globalThis.clearInterval(id), exitHandlerName);

        return () => {
            ns.atExit(() => null, exitHandlerName);
            globalThis.clearInterval(id);
        };
    }, [ns, interval, updateFn]);

    return data;
}

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
