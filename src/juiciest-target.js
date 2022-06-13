import { exploitableHosts } from "./lib.js";
import { walkNetworkBFS } from "./walk-network.js";

/** @param {NS} ns */
export async function main(ns) {
  let allHosts = walkNetworkBFS(ns);

  let bestScore = 0.0;
  let bestHost = null;

  for (const host of exploitableHosts(ns, allHosts)) {
    let hostMaxMoney = ns.getServerMaxMoney(host);
    let hostMinSecurity = ns.getServerMinSecurityLevel(host);
    let hostScore = hostMaxMoney / hostMinSecurity;

    if (hostScore > bestScore) {
      bestScore = hostScore;
      bestHost = host;
    }

  }

  ns.tprintf("best host to target is ``", bestHost);
}
