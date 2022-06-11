/** @param {NS} ns */
export async function main(ns) {
  let host = ns.args[0];
  let script = ns.args[1];
  let threads = ns.args[2];
  let waitTime = ns.args[3];
  await ns.sleep(waitTime);
  ns.exec(script, host, threads);
}
