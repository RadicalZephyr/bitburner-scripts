import type { NS, UserInterfaceTheme } from 'netscript';

import { makeFuid } from 'util/fuid';

/**
 * Get an updating state value derived from polling the given function.
 *
 * @template T
 * @param {number} interval  - Milliseconds between polling `pollFn`
 * @param {() => T} pollFn   - Function to poll state changes
 * @returns {T} Reactive state produced by `pollFn`
 */
export function usePoll<T>(ns: NS, interval: number, pollFn: () => T): T {
    const [data, setData] = React.useState(pollFn());

    React.useEffect(() => {
        let id: number | null;
        id = globalThis.setInterval(() => {
            try {
                setData(pollFn());
            } catch (err) {
                console.error(err);
                if (id != null) globalThis.clearInterval(id);
                id = null;
            }
        }, interval);

        const exitHandlerName = 'usePoll-' + makeFuid(ns);

        ns.atExit(() => {
            if (id != null) globalThis.clearInterval(id);
            id = null;
        }, exitHandlerName);

        return () => {
            ns.atExit(() => null, exitHandlerName);
            if (id != null) globalThis.clearInterval(id);
            id = null;
        };
    }, [ns, interval, pollFn]);

    return data;
}

/**
 * Get an updating state value derived from polling the Netscript API
 * with an update function.
 *
 * @template T
 * @param {NS} ns                  - Netscript API instance
 * @param {number} interval        - Milliseconds between polling `updateFn`
 * @param {(ns: NS) => T} updateFn - Function to poll state from Netscript APIs
 * @returns {T} Reactive state produced by `updateFn`
 */
export function useNsUpdate<T>(
    ns: NS,
    interval: number,
    updateFn: (ns: NS) => T,
): T {
    const [data, setData] = React.useState(updateFn(ns));

    React.useEffect(() => {
        let id: number | null;
        id = globalThis.setInterval(() => {
            try {
                setData(updateFn(ns));
            } catch (err) {
                console.error(err);
                if (id != null) globalThis.clearInterval(id);
                id = null;
            }
        }, interval);

        const exitHandlerName = 'useNsUpdate-' + makeFuid(ns);

        ns.atExit(() => {
            if (id != null) globalThis.clearInterval(id);
            id = null;
        }, exitHandlerName);

        return () => {
            ns.atExit(() => null, exitHandlerName);
            if (id != null) globalThis.clearInterval(id);
            id = null;
        };
    }, [ns, interval, updateFn]);

    return data;
}

/**
 * Keep a UserInterfaceTheme updated by polling `ns.ui.getTheme()`.
 *
 * @param {NS} ns - Netscript API instance
 * @param {number} interval - Milliseconds between theme refreshes
 * @returns {UserInterfaceTheme} The current theme from the UI
 */
export function useTheme(ns: NS, interval = 200): UserInterfaceTheme {
    return useNsUpdate(ns, interval, getTheme);
}

/**
 * Return the current UI theme.
 *
 * @param {NS} ns
 * @returns {UserInterfaceTheme}
 */
function getTheme(ns: NS): UserInterfaceTheme {
    return ns.ui.getTheme();
}
