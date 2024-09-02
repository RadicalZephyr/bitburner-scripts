import type { NS } from "netscript";

export async function main(ns: NS) {
    const args = ns.args;

    const target = args[0];
    if (typeof target != 'string') {
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 0;
    }

    let rounds = args[2];
    if (typeof rounds != 'number') {
        rounds = 1;
    }

    let endDelay = args[3];
    if (typeof endDelay != 'number') {
        endDelay = 0;
    }

    for (let i = 0; i < rounds; i++) {
        await ns.sleep(sleepTime);
        await ns.hack(target);
        await ns.sleep(endDelay);
    }
}
