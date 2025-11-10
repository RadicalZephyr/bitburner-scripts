import { parseFlags } from 'util/flags';
const FLAGS = [
    ['all', false],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help || typeof flags.all != 'boolean') {
        ns.tprint(`USAGE: run ${ns.getScriptName()} [-all] PORT_NUM...

This script clears the ports specified by PORT_NUMs or all ports up to
PORT_NUM.

OPTIONS
 --all    Clear all port numbers from 0 up until 99,999 or the first specified port number
 --help   Displays this help message
`);
        return;
    }
    const rest = flags._;
    // If no ports are specified, default to clearing all ports
    if (rest.length === 0)
        flags.all = true;
    let clearedPorts = 0;
    let maxPort = 99999;
    for (const arg of rest) {
        const portNum = Number(arg);
        if (Number.isFinite(portNum)) {
            ns.clearPort(portNum);
            clearedPorts += 1;
            if (maxPort < portNum) {
                maxPort = portNum;
            }
        }
    }
    if (flags.all) {
        for (let i = 1; i <= maxPort; i++) {
            ns.clearPort(i);
            clearedPorts += 1;
            if (i % 500 === 0) {
                await ns.sleep(0);
            }
        }
    }
    const finishedMsg = `finished clearing ${clearedPorts} ports`;
    ns.toast(finishedMsg);
    ns.tprint(finishedMsg);
}
