/** @param {NS} ns */
export async function main(ns) {
  await startEmbeddedScript(ns, "only-hack.js", hackScript, ns.args);
  await startEmbeddedScript(ns, "only-grow.js", growScript, ns.args);
  await startEmbeddedScript(ns, "only-weaken.js", weakenScript, ns.args);
}

/** Unpack and start running an embedded script with the specified parallelism and arguments.
 *
 * @param {NS} ns
 * @param {string} name
 * @param {string} script
 * @param {number} threads
 * @param {string[]} args
 */
async function startEmbeddedScript(ns, name, script, threads, args) {
  await ns.write(name, script, "w");
  ns.run(name, threads, ...args);
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
