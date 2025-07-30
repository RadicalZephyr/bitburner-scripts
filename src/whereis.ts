import type { NS, AutocompleteData, ScriptArg } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
import { FlagsSchema } from 'util/flags';

import { shortestPath } from 'util/shortest-path';

const FLAGS = [
    ['goto', false],
    ['startingHost', ''],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    const rest = flags._ as ScriptArg[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

This script prints the path between two servers in the network.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help           Show this help message
  --startingHost   The host to start the search from
  --goto           If sufficient RAM is available (+25GB) send player to SERVER_NAME
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const startingHost = parseStartingHost(ns, flags.startingHost);
    if (!ns.serverExists(startingHost)) {
        ns.tprintf('start host %s does not exist', startingHost);
        return;
    }

    const goalHost = rest[0];
    if (typeof goalHost !== 'string' || !ns.serverExists(goalHost)) {
        ns.tprintf('goal host %s does not exist', goalHost);
        return;
    }

    const path = await shortestPath(ns, startingHost, goalHost);

    const goCommand = `go ${path.join(' ; go ')}`;

    if (flags.goto) {
        // Acquire a reference to the terminal text field
        const terminalInput = globalThis['terminal-input'];
        if (!(terminalInput instanceof HTMLInputElement)) return;

        terminalInput.value = goCommand;

        // Get a reference to the React event handler.
        const handler = Object.keys(terminalInput)[1];

        // Perform an onChange event to set some internal values.
        terminalInput[handler].onChange({ target: terminalInput });

        // Simulate an enter press
        terminalInput[handler].onKeyDown({
            key: 'Enter',
            preventDefault: (): void => null,
        });
    } else {
        ns.tprintf(`path to ${goalHost}:\n ${goCommand}`);
    }
}

function parseStartingHost(ns: NS, startingHost: ScriptArg | string[]): string {
    if (typeof startingHost === 'string' && startingHost !== '') {
        return startingHost;
    }
    return ns.self().server;
}
