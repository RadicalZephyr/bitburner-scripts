import type { NS } from "netscript";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['grow', 0],
        ['hack', 0],
        ['weaken', 0]
    ]);
    await startEmbeddedScript(ns, "only-hack.js", hackScript, flags.hack, ns.args);
    await startEmbeddedScript(ns, "only-grow.js", growScript, flags.grow, ns.args);
    await startEmbeddedScript(ns, "only-weaken.js", weakenScript, flags.weaken, ns.args);
}

/** Unpack and start running an embedded script with the specified parallelism and arguments.
 *
 * @param {NS} ns
 * @param {string} name
 * @param {string} script
 * @param {number} threads
 * @param {(string | number | boolean)[]} args
 */
async function startEmbeddedScript(ns: NS, name: string, script: string, threads: number, args: (string | number | boolean)[]) {
    await ns.write(name, script, "w");
    if (threads > 0) {
        ns.printf("running %s with %s threads", name, threads);
        ns.run(name, threads, ...args);
    }
}

const hackScript = `
export async function main(ns) {
    while (true) { await ns.hack(ns.args[0]); }
}
`;

const growScript = `
export async function main(ns) {
    while (true) { await ns.grow(ns.args[0]); }
}
`;

const weakenScript = `
export async function main(ns) {
    while (true) { await ns.weaken(ns.args[0]); }
}
`;
