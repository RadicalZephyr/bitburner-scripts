import type { NS } from "netscript";

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string') {
        ns.print('invalid target: %s', target);
        return;
    }

    let sleepTime = ns.args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 0;
    }

    await ns.sleep(sleepTime);
    await ns.weaken(target);
    ns.tprint(`weakening ${target} done`);
}
