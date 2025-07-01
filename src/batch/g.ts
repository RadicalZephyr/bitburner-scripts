import type { NS } from "netscript";

declare global {
    interface Performance {
        mark: ((name: string) => void),
    }
    interface Global {
        performance: Performance
    }
    var globalThis: Global;
}

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

    await ns.grow(target, { additionalMsec: sleepTime });
    globalThis.performance.mark("grow");
}
