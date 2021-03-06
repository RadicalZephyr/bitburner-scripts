import type { NS } from "netscript";

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string') {
        ns.print('invalid target: %s', target);
        return;
    }

    const sleepTime = ns.args[1];
    if (typeof sleepTime != 'number') {
        ns.print('invalid sleep time: %s', sleepTime);
        return;
    }

    await ns.sleep(sleepTime);
    await ns.grow(target);
    ns.tprint(`growing ${target} done`);
}
