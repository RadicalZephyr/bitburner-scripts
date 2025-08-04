import type { NS, UserInterfaceTheme } from 'netscript';

import { makeFuid } from 'util/fuid';

/**
 * Keep a UserInterfaceTheme updated by polling `ns.ui.getTheme()`.
 *
 * @param ns - Netscript API instance
 * @param interval - Milliseconds between theme refreshes
 * @returns The current theme from the UI
 */
export function useTheme(ns: NS, interval = 200): UserInterfaceTheme {
    const [theme, setTheme] = React.useState(
        ns.ui.getTheme() as UserInterfaceTheme,
    );

    React.useEffect(() => {
        const id = globalThis.setInterval(() => {
            setTheme(ns.ui.getTheme());
        }, interval);

        ns.atExit(
            () => globalThis.clearInterval(id),
            'useTheme-' + makeFuid(ns),
        );

        return () => {
            globalThis.clearInterval(id);
        };
    }, [ns, interval]);

    return theme;
}
