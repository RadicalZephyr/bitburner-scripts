import type { NS } from "netscript";

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string') {
        ns.tprint('invalid target: %s', target);
        return;
    }

    let sleepTime = ns.args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 0;
    }

    let endDelay = ns.args[2];
    if (typeof endDelay != 'number') {
        endDelay = 0;
    }

    await ns.sleep(sleepTime);
    await ns.hack(target);
    await ns.sleep(endDelay);
}
