import { getRootAccess, numThreads, exploitableHosts, usableHosts } from 'lib.js';
import { walkNetworkBFS } from "walk-network.js";

/** @param {NS} ns */
export async function main(ns) {
  let hackScript = "hack.js";

  let allHosts = await walkNetworkBFS(ns);

  let hosts = usableHosts(ns, allHosts);
  let targets = exploitableHosts(ns, allHosts);
  ns.tprintf("hosts: [%s]\ntargets: [%s]\n", hosts.join(", "), targets.join(", "));

  await startHosts(ns, hosts, targets, hackScript);
}

/**
 *
 * @param {NS} ns
 * @param {string[]} hosts
 * @param {string} target
 * @param {string} hackScript
 */
async function startHosts(ns, hosts, targets, hackScript) {
  let hackScriptRam = ns.getScriptRam(hackScript);

  for (const target of targets) {
    await getRootAccess(ns, target);
  }

  let targetIndex = 0;
  let maxSingleTargetThreads = 40;

  for (let i = 0; i < hosts.length; ++i) {
    let host = hosts[i];
    let threads = numThreads(ns, host, hackScriptRam);

    if (threads === 0) {
      continue;
    }

    if (await getRootAccess(ns, host)) {
      await ns.scp(hackScript, host);

      if (threads > targets.length * 10) {
        let threadsPerTarget = Math.floor(threads / targets.length);
        for (const target of targets) {
          ns.exec(hackScript, host, threadsPerTarget, target);
        }
      } else if (threads > maxSingleTargetThreads) {
        while (threads > maxSingleTargetThreads) {
          let target = targets[targetIndex++ % targets.length];
          ns.exec(hackScript, host, maxSingleTargetThreads, target);
          threads -= maxSingleTargetThreads;
        }
        let target = targets[targetIndex++ % targets.length];
        ns.exec(hackScript, host, threads, target);
      } else {
        let target = targets[targetIndex++ % targets.length];
        ns.exec(hackScript, host, threads, target);
      }
    }
  }
}
