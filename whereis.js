import { parseFlags } from 'util/flags';
import { shortestPath } from 'util/shortest-path';
import { sendTerminalCommand } from 'util/terminal';
const FLAGS = [
    ['goto', false],
    ['startingHost', ''],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return data.servers;
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    const rest = flags._;
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
        try {
            await sendTerminalCommand(ns, goCommand);
        }
        catch (err) {
            ns.tprintf('failed to execute path: %s', String(err));
        }
    }
    else {
        ns.tprintf(`path to ${goalHost}:\n ${goCommand}`);
    }
}
function parseStartingHost(ns, startingHost) {
    if (startingHost !== '') {
        return startingHost;
    }
    return ns.self().server;
}
