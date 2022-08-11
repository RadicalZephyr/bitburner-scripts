import type { NS } from "netscript";

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.clearLog();

    const args = ns.args;

    const target = args[0];
    if (typeof target != 'string') {
        return;
    }

    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 1;
    }

    await ns.sleep(sleepTime);
    await ns.weaken(target);
}
