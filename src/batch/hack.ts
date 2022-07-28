import type { NS } from "netscript";

export async function main(ns: NS) {
    const options = ns.flags([
        ['loop', false]
    ]);

    const args = options._;

    const target = args[0];
    if (typeof target != 'string') {
        ns.tprint('invalid target: %s', target);
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 0;
    }

    let endDelay = args[2];
    if (typeof endDelay != 'number' || endDelay < 20) {
        endDelay = 20;
    }

    do {
        await ns.sleep(sleepTime);
        await ns.hack(target);
        await ns.sleep(endDelay);
    } while (options.loop);
}
