import type { NS } from "netscript";

export async function main(ns: NS) {
    let portNum = ns.args[0];
    if (typeof portNum !== 'number') {
        ns.tprintf('clear port run with non-number port argument');
        return;
    }
    let port = ns.getPortHandle(portNum);
    port.clear();
}
