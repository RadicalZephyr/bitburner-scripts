import type { NS } from "netscript";

export async function main(ns: NS) {
    const args = ns.args;

    const target = args[0];
    if (typeof target != 'string') {
        ns.tprint('invalid target: %s', target);
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 1;
    }

    await ns.sleep(sleepTime);
    await ns.weaken(target);
}
