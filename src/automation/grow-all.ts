import type { NS } from 'netscript';

import { walkNetworkBFS } from 'util/walk';

import { shortestPath } from 'util/shortest-path';

export async function main(ns: NS) {
    const network = walkNetworkBFS(ns);
    const hosts = network.keys();

    for (const host of hosts) {
        const maxMoney = ns.getServerMaxMoney(host);
        const curMoney = ns.getServerMoneyAvailable(host);
        if (curMoney >= maxMoney * 0.99) continue;

        await manualGrowHost(ns, host);
    }
}

async function manualGrowHost(ns: NS, host: string) {
    const currentHost = ns.singularity.getCurrentServer();
    const path = await shortestPath(ns, currentHost, host);
    await traverseNetworkPath(ns, path);
    await manualGrow(ns);
}

async function traverseNetworkPath(ns: NS, path: string[]) {
    for (const host of path) {
        const currentHost = ns.singularity.getCurrentServer();
        if (!ns.singularity.connect(host))
            throw new Error(`failed to connect to ${host} from ${currentHost}`);
    }
    await ns.sleep(0);
}

async function manualGrow(ns: NS) {
    // Acquire a reference to the terminal text field
    const terminalInput = globalThis['terminal-input'];
    if (!(terminalInput instanceof HTMLInputElement)) return;

    terminalInput.value = 'grow';

    // Get a reference to the React event handler.
    const handler = Object.keys(terminalInput)[1];

    // Perform an onChange event to set some internal values.
    terminalInput[handler].onChange({ target: terminalInput });

    // Simulate an enter press
    terminalInput[handler].onKeyDown({
        key: 'Enter',
        preventDefault: (): void => null,
    });
    await ns.sleep(2000);
}
