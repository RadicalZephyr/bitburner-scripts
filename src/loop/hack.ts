import type { NS } from "netscript";

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string') {
        ns.print('invalid target: %s', target);
        return;
    }

    while (true) {
        await ns.hack(target);
    }
}
