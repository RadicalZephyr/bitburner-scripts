import type { NS } from "netscript";

export async function main(ns: NS) {
    const args = ns.args;

    const target = args[0];
    if (typeof target != 'string') {
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 1;
    }

    let rounds = args[1];
    if (typeof rounds != 'number') {
        sleepTime = 1;
    }

    for (let i = 0; i < rounds; i++) {
        await ns.sleep(sleepTime);
        await ns.weaken(target);
    }
}
