import type { NS } from "netscript";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['all', false],
        ['help', false],
    ]);
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

    let maxPort = 99999;
    for (const arg of flags._) {
        let portNum = Number(arg);
        if (!Number.isNaN(portNum)) {
            ns.clearPort(portNum);
            if (maxPort < portNum) {
                maxPort = portNum;
            }
        }
    }

    if (flags.all) {
        for (let i = 1; i <= maxPort; i++) {
            ns.clearPort(i);
            if (i % 500 === 0) {
                await ns.sleep(10);
            }
        }
    }
}
